import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LDIF, LdifContentItem, normalizeSourceData } from '@leanix-mock/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MetaModelService } from '../../meta-model/meta-model.service';
import { SyncLogService } from '../sync/sync-log.service';
import { SyncRunService } from '../sync/sync-run.service';
import { INTERACTIVE_TX_OPTIONS } from '../../common/prisma/transaction-options';
import { FactSheetEvent } from '../../graphql/services/fact-sheet.service';

const NATIVE_KEYS = new Set(['name', 'description', 'externalId', 'lifecycle']);

export interface LdifProcessingCounts {
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  errorCount: number;
  warningCount: number;
}

const TECHNICAL_USER_ID = 'user-technical';

@Injectable()
export class LdifProcessor {
  private readonly logger = new Logger(LdifProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaModel: MetaModelService,
    private readonly syncRunService: SyncRunService,
    private readonly syncLogService: SyncLogService,
    private readonly events: EventEmitter2,
  ) {}

  async process(syncRunId: string, ldif: LDIF): Promise<void> {
    await this.syncRunService.markRunning(syncRunId);

    const counts: LdifProcessingCounts = { processedCount: 0, createdCount: 0, updatedCount: 0, deletedCount: 0, errorCount: 0, warningCount: 0 };
    const sourceIdToFactSheetId = new Map<string, string>();
    const itemsToLink: Array<{ item: LdifContentItem; factSheetId: string; factSheetTypeKey: string }> = [];

    for (const item of ldif.content) {
      try {
        const outcome = await this.processItem(syncRunId, ldif, item, counts);
        if (outcome) {
          sourceIdToFactSheetId.set(item.id, outcome.factSheetId);
          itemsToLink.push({ item, factSheetId: outcome.factSheetId, factSheetTypeKey: outcome.factSheetTypeKey });
        }
      } catch (err) {
        counts.errorCount += 1;
        await this.syncLogService.log(syncRunId, 'ERROR', `Failed to process item "${item.id}": ${(err as Error).message}`, {
          sourceRecordId: item.id,
        });
      }
      counts.processedCount += 1;
    }

    for (const { item, factSheetId, factSheetTypeKey } of itemsToLink) {
      await this.processRelations(syncRunId, ldif, item, factSheetId, sourceIdToFactSheetId).catch(async (err) => {
        counts.warningCount += 1;
        await this.syncLogService.log(syncRunId, 'WARNING', `Failed to process relations for "${item.id}": ${(err as Error).message}`, {
          sourceRecordId: item.id,
          factSheetId,
        });
      });
      void factSheetTypeKey;
    }

    await this.syncRunService.markFinished(syncRunId, counts);
  }

  private async processItem(
    syncRunId: string,
    ldif: LDIF,
    item: LdifContentItem,
    counts: LdifProcessingCounts,
  ): Promise<{ factSheetId: string; factSheetTypeKey: string } | null> {
    const type = await this.metaModel.findTypeByKey(item.type);
    if (!type) {
      counts.errorCount += 1;
      await this.syncLogService.log(syncRunId, 'ERROR', `Fact sheet type "${item.type}" does not exist`, { sourceRecordId: item.id });
      return null;
    }

    const externalId = (item.data.externalId as string | undefined) ?? item.id;
    const sourceHash = createHash('sha256').update(normalizeSourceData(item.data)).digest('hex');

    const existingMapping = await this.prisma.syncMapping.findUnique({
      where: { sourceSystem_sourceRecordId: { sourceSystem: ldif.connectorId, sourceRecordId: item.id } },
    });

    let factSheetId = existingMapping?.factSheetId;
    if (!factSheetId) {
      const existingByExternalId = await this.prisma.factSheet.findFirst({ where: { typeId: type.id, externalId } });
      factSheetId = existingByExternalId?.id;
    }

    const isNewFactSheet = !factSheetId;

    if (existingMapping && existingMapping.syncHash === sourceHash && ldif.processingMode === 'partial') {
      await this.syncLogService.log(syncRunId, 'INFO', `No changes detected for "${item.id}", skipped`, {
        sourceRecordId: item.id,
        factSheetId,
      });
      return { factSheetId: factSheetId!, factSheetTypeKey: type.technicalKey };
    }

    const { native, custom, unknown } = await this.splitFields(type.id, item.data);
    for (const key of unknown) {
      counts.warningCount += 1;
      await this.syncLogService.log(syncRunId, 'WARNING', `Unknown field "${key}" skipped for "${item.id}"`, { sourceRecordId: item.id });
    }

    if (isNewFactSheet) {
      const created = await this.prisma.factSheet.create({
        data: {
          typeId: type.id,
          name: (native.name as string) ?? item.id,
          displayName: (native.name as string) ?? item.id,
          description: native.description as string | undefined,
          externalId,
          lifecycle: native.lifecycle as any,
          status: 'ACTIVE',
          qualitySeal: 'BROKEN',
          createdBy: TECHNICAL_USER_ID,
          updatedBy: TECHNICAL_USER_ID,
        },
      });
      factSheetId = created.id;
      counts.createdCount += 1;
      await this.applyCustomAttributes(factSheetId, custom, ldif.processingMode);
      await this.recalculateCompletion(factSheetId, type.id);
      await this.syncLogService.log(syncRunId, 'INFO', `Created fact sheet "${created.name}" from "${item.id}"`, {
        sourceRecordId: item.id,
        factSheetId,
      });
      this.emitEvent('FACT_SHEET_CREATED', factSheetId, type.technicalKey, created.name, externalId);
    } else {
      const updateData: Record<string, unknown> = { updatedBy: TECHNICAL_USER_ID };
      if (ldif.processingMode === 'full') {
        updateData.description = native.description ?? null;
        updateData.lifecycle = native.lifecycle ?? null;
      }
      for (const key of Object.keys(native)) {
        updateData[key] = native[key];
      }
      if (updateData.name) {
        updateData.displayName = updateData.name;
      }

      const updated = await this.prisma.factSheet.update({ where: { id: factSheetId! }, data: updateData });
      counts.updatedCount += 1;
      await this.applyCustomAttributes(factSheetId!, custom, ldif.processingMode);
      await this.recalculateCompletion(factSheetId!, type.id);
      await this.syncLogService.log(syncRunId, 'INFO', `Updated fact sheet "${updated.name}" from "${item.id}"`, {
        sourceRecordId: item.id,
        factSheetId,
      });
      this.emitEvent('FACT_SHEET_UPDATED', factSheetId!, type.technicalKey, updated.name, updated.externalId);
    }

    await this.prisma.syncMapping.upsert({
      where: { sourceSystem_sourceRecordId: { sourceSystem: ldif.connectorId, sourceRecordId: item.id } },
      update: { factSheetId: factSheetId!, syncHash: sourceHash, lastSyncedAt: new Date(), factSheetType: type.technicalKey },
      create: {
        sourceSystem: ldif.connectorId,
        sourceRecordId: item.id,
        factSheetId: factSheetId!,
        factSheetType: type.technicalKey,
        syncHash: sourceHash,
        lastSyncedAt: new Date(),
      },
    });

    return { factSheetId: factSheetId!, factSheetTypeKey: type.technicalKey };
  }

  private async splitFields(factSheetTypeId: string, data: Record<string, unknown>) {
    const native: Record<string, unknown> = {};
    const custom: Record<string, unknown> = {};
    const unknown: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (NATIVE_KEYS.has(key)) {
        native[key] = value;
        continue;
      }
      if (key.startsWith('rel')) {
        continue; // handled separately in processRelations
      }
      const attribute = await this.prisma.attribute.findFirst({ where: { factSheetTypeId, technicalKey: key } });
      if (attribute) {
        custom[key] = value;
      } else {
        unknown.push(key);
      }
    }

    return { native, custom, unknown };
  }

  private async applyCustomAttributes(factSheetId: string, custom: Record<string, unknown>, mode: 'partial' | 'full') {
    const attributes = await this.prisma.attributeValue.findMany({ where: { factSheetId }, include: { attribute: true } });

    for (const [key, value] of Object.entries(custom)) {
      const attribute = await this.prisma.attribute.findFirst({ where: { technicalKey: key } });
      if (!attribute) continue;
      await this.prisma.attributeValue.upsert({
        where: { factSheetId_attributeId: { factSheetId, attributeId: attribute.id } },
        update: { value: value as any },
        create: { factSheetId, attributeId: attribute.id, value: value as any },
      });
    }

    if (mode === 'full') {
      const providedKeys = new Set(Object.keys(custom));
      const toRemove = attributes.filter((av) => !providedKeys.has(av.attribute.technicalKey));
      for (const av of toRemove) {
        await this.prisma.attributeValue.delete({ where: { id: av.id } });
      }
    }
  }

  private async recalculateCompletion(factSheetId: string, factSheetTypeId: string) {
    await this.prisma.$transaction(async (tx) => {
      const mandatoryAttributes = await tx.attribute.findMany({ where: { factSheetTypeId, mandatory: true } });
      if (mandatoryAttributes.length === 0) return;

      const [factSheet, attributeValues] = await Promise.all([
        tx.factSheet.findUniqueOrThrow({ where: { id: factSheetId } }),
        tx.attributeValue.findMany({ where: { factSheetId }, include: { attribute: true } }),
      ]);

      const valueByKey = new Map<string, unknown>([
        ['name', factSheet.name],
        ['description', factSheet.description],
        ['externalId', factSheet.externalId],
        ['lifecycle', factSheet.lifecycle],
      ]);
      for (const av of attributeValues) {
        valueByKey.set(av.attribute.technicalKey, av.value);
      }

      const isFilled = (v: unknown) => v !== null && v !== undefined && (typeof v !== 'string' || v.trim().length > 0);
      const filled = mandatoryAttributes.filter((attr) => isFilled(valueByKey.get(attr.technicalKey))).length;
      const completion = Math.round((filled / mandatoryAttributes.length) * 1000) / 10;

      await tx.factSheet.update({ where: { id: factSheetId }, data: { completion } });
    }, INTERACTIVE_TX_OPTIONS);
  }

  private async processRelations(
    syncRunId: string,
    ldif: LDIF,
    item: LdifContentItem,
    sourceFactSheetId: string,
    sourceIdToFactSheetId: Map<string, string>,
  ): Promise<void> {
    const relationEntries = Object.entries(item.data).filter(([key]) => key.startsWith('rel'));

    for (const [relationKey, rawTargets] of relationEntries) {
      const relationType = await this.metaModel.findRelationTypeByKey(relationKey);
      if (!relationType) {
        await this.syncLogService.log(syncRunId, 'WARNING', `Unknown relation type "${relationKey}" skipped for "${item.id}"`, {
          sourceRecordId: item.id,
          factSheetId: sourceFactSheetId,
        });
        continue;
      }

      const targetSourceIds = Array.isArray(rawTargets) ? (rawTargets as string[]) : [String(rawTargets)];
      const resolvedTargetIds: string[] = [];

      for (const targetSourceId of targetSourceIds) {
        let targetFactSheetId = sourceIdToFactSheetId.get(targetSourceId);
        if (!targetFactSheetId) {
          const mapping = await this.prisma.syncMapping.findUnique({
            where: { sourceSystem_sourceRecordId: { sourceSystem: ldif.connectorId, sourceRecordId: targetSourceId } },
          });
          targetFactSheetId = mapping?.factSheetId;
        }
        if (!targetFactSheetId) {
          await this.syncLogService.log(syncRunId, 'WARNING', `Relation target "${targetSourceId}" not found for "${item.id}"`, {
            sourceRecordId: item.id,
            factSheetId: sourceFactSheetId,
          });
          continue;
        }

        resolvedTargetIds.push(targetFactSheetId);
        const relation = await this.prisma.relation.upsert({
          where: {
            relationTypeId_sourceId_targetId: { relationTypeId: relationType.id, sourceId: sourceFactSheetId, targetId: targetFactSheetId },
          },
          update: {},
          create: { relationTypeId: relationType.id, sourceId: sourceFactSheetId, targetId: targetFactSheetId },
        });

        const source = await this.prisma.factSheet.findUnique({ where: { id: sourceFactSheetId }, include: { type: true } });
        const target = await this.prisma.factSheet.findUnique({ where: { id: targetFactSheetId }, include: { type: true } });
        if (source && target) {
          this.events.emit('factsheet.event', {
            eventType: 'RELATION_CREATED',
            factSheet: { id: source.id, type: source.type.technicalKey, name: source.name, externalId: source.externalId },
            actor: this.syntheticActor(),
            changes: [],
            relation: {
              id: relation.id,
              type: relationType.technicalKey,
              target: { id: target.id, type: target.type.technicalKey, name: target.name, externalId: target.externalId },
            },
          } satisfies FactSheetEvent);
        }
      }

      if (ldif.processingMode === 'full') {
        await this.prisma.relation.deleteMany({
          where: { relationTypeId: relationType.id, sourceId: sourceFactSheetId, targetId: { notIn: resolvedTargetIds } },
        });
      }
    }
  }

  private emitEvent(eventType: FactSheetEvent['eventType'], id: string, type: string, name: string, externalId: string | null) {
    this.events.emit('factsheet.event', {
      eventType,
      factSheet: { id, type, name, externalId },
      actor: this.syntheticActor(),
      changes: [],
    } satisfies FactSheetEvent);
  }

  private syntheticActor(): FactSheetEvent['actor'] {
    return {
      sub: TECHNICAL_USER_ID,
      iss: 'leanix-mock',
      aud: 'leanix-services',
      iat: 0,
      exp: 0,
      workspaceId: 'ws-development',
      workspaceName: 'development',
      workspaceRole: 'ADMIN',
      userName: 'technical-user@mock.local',
    };
  }
}
