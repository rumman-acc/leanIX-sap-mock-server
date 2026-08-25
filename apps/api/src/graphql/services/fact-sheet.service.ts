import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { BaseFactSheetInput, FilterInput, JwtClaims, SortInput } from '@leanix-mock/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeanIxException } from '../../common/exceptions/leanix.exception';
import { MetaModelService } from '../../meta-model/meta-model.service';
import { LeanIxConfig } from '../../config/leanix.config';
import { encodeCursor, decodeCursor } from './cursor.util';

export const FACT_SHEET_INCLUDE = {
  type: true,
  attributes: { include: { attribute: true } },
  tags: { include: { tag: { include: { group: true } } } },
  subscriptions: true,
  sourceRelations: {
    include: {
      relationType: { include: { sourceType: true, targetType: true } },
      target: { include: { type: true } },
    },
  },
  targetRelations: {
    include: {
      relationType: { include: { sourceType: true, targetType: true } },
      source: { include: { type: true } },
    },
  },
} as const;

const NON_ATTRIBUTE_KEYS = new Set(['name', 'description', 'externalId', 'lifecycle']);
const MAX_NAME_LENGTH = 255;

export interface FactSheetEvent {
  eventType:
    | 'FACT_SHEET_CREATED'
    | 'FACT_SHEET_UPDATED'
    | 'FACT_SHEET_ARCHIVED'
    | 'RELATION_CREATED'
    | 'FACT_SHEET_FIELD_UPDATED';
  factSheet: { id: string; type: string; name: string; externalId: string | null };
  actor: JwtClaims;
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  relation?: { id: string; type: string; target: { id: string; type: string; name: string; externalId: string | null } };
}

@Injectable()
export class FactSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaModel: MetaModelService,
    private readonly events: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async findById(id: string) {
    return this.prisma.factSheet.findUnique({ where: { id }, include: FACT_SHEET_INCLUDE });
  }

  async requireById(id: string) {
    const factSheet = await this.findById(id);
    if (!factSheet) {
      throw new LeanIxException('FACT_SHEET_NOT_FOUND', `Fact sheet "${id}" does not exist`, { id });
    }
    return factSheet;
  }

  async findMany(opts: { filter?: FilterInput; sort?: SortInput; first?: number; after?: string }) {
    const where = await this.buildWhere(opts.filter);
    const orderBy = this.buildOrderBy(opts.sort);
    const take = Math.min(opts.first ?? 50, 500);
    const cursorId = opts.after ? decodeCursor(opts.after) : undefined;

    const [totalCount, rows] = await Promise.all([
      this.prisma.factSheet.count({ where }),
      this.prisma.factSheet.findMany({
        where,
        orderBy,
        include: FACT_SHEET_INCLUDE,
        take: take + 1,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      }),
    ]);

    const hasNextPage = rows.length > take;
    const pageRows = hasNextPage ? rows.slice(0, take) : rows;

    return {
      totalCount,
      edges: pageRows.map((node) => ({ node, cursor: encodeCursor(node.id) })),
      pageInfo: {
        hasNextPage,
        hasPreviousPage: Boolean(opts.after),
        startCursor: pageRows.length ? encodeCursor(pageRows[0].id) : null,
        endCursor: pageRows.length ? encodeCursor(pageRows[pageRows.length - 1].id) : null,
      },
    };
  }

  async search(query: string, first?: number, after?: string) {
    const take = Math.min(first ?? 50, 500);
    const cursorId = after ? decodeCursor(after) : undefined;
    const where = {
      trashBin: false,
      OR: [
        { name: { contains: query, mode: 'insensitive' as const } },
        { description: { contains: query, mode: 'insensitive' as const } },
      ],
    };

    const [totalCount, rows] = await Promise.all([
      this.prisma.factSheet.count({ where }),
      this.prisma.factSheet.findMany({
        where,
        include: { type: true },
        orderBy: { updatedAt: 'desc' },
        take: take + 1,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      }),
    ]);

    const hasNextPage = rows.length > take;
    const pageRows = hasNextPage ? rows.slice(0, take) : rows;

    return {
      totalCount,
      edges: pageRows.map((node) => ({
        node: {
          id: node.id,
          name: node.name,
          type: node.type.technicalKey,
          description: node.description,
          highlight: node.description ?? node.name,
        },
        cursor: encodeCursor(node.id),
      })),
      pageInfo: {
        hasNextPage,
        hasPreviousPage: Boolean(after),
        startCursor: pageRows.length ? encodeCursor(pageRows[0].id) : null,
        endCursor: pageRows.length ? encodeCursor(pageRows[pageRows.length - 1].id) : null,
      },
    };
  }

  async create(input: BaseFactSheetInput, actor: JwtClaims) {
    this.validateName(input.name);
    const type = await this.metaModel.requireTypeByKey(input.type);

    if (input.externalId) {
      await this.assertExternalIdUnique(type.id, input.externalId);
    }

    const factSheet = await this.prisma.$transaction(async (tx) => {
      const created = await tx.factSheet.create({
        data: {
          typeId: type.id,
          name: input.name,
          displayName: input.name,
          description: input.description,
          externalId: input.externalId,
          status: 'ACTIVE',
          qualitySeal: 'BROKEN',
          createdBy: actor.sub,
          updatedBy: actor.sub,
        },
      });

      if (input.tags?.length) {
        await this.applyTagsWithinTx(tx, created.id, input.tags);
      }
      if (input.subscriptions?.length) {
        await this.applySubscriptionsWithinTx(tx, created.id, input.subscriptions);
      }

      await this.recalculateCompletionWithinTx(tx, created.id, type.id);
      return tx.factSheet.findUniqueOrThrow({ where: { id: created.id }, include: FACT_SHEET_INCLUDE });
    });

    this.events.emit('factsheet.event', {
      eventType: 'FACT_SHEET_CREATED',
      factSheet: { id: factSheet.id, type: factSheet.type.technicalKey, name: factSheet.name, externalId: factSheet.externalId },
      actor,
      changes: [],
    } satisfies FactSheetEvent);

    return factSheet;
  }

  async archive(id: string, actor: JwtClaims) {
    const factSheet = await this.requireById(id);
    const retentionDays = this.configService.get<LeanIxConfig>('leanix')!.trashBinRetentionDays;
    const archivedAt = new Date();
    const autoDeleteAt = new Date(archivedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.factSheet.update({
        where: { id },
        data: { status: 'ARCHIVED', trashBin: true, archivedAt, autoDeleteAt, updatedBy: actor.sub },
        include: FACT_SHEET_INCLUDE,
      });
      await tx.trashBinEntry.upsert({
        where: { factSheetId: id },
        update: { archivedAt, autoDeleteAt, name: result.name, externalId: result.externalId },
        create: {
          factSheetId: id,
          factSheetType: result.type.technicalKey,
          name: result.name,
          externalId: result.externalId,
          archivedAt,
          autoDeleteAt,
        },
      });
      return result;
    });

    this.events.emit('factsheet.event', {
      eventType: 'FACT_SHEET_ARCHIVED',
      factSheet: { id: updated.id, type: updated.type.technicalKey, name: updated.name, externalId: updated.externalId },
      actor,
      changes: [{ field: 'status', oldValue: factSheet.status, newValue: 'ARCHIVED' }],
    } satisfies FactSheetEvent);

    return updated;
  }

  async revive(id: string, actor: JwtClaims) {
    await this.requireById(id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.factSheet.update({
        where: { id },
        data: { status: 'ACTIVE', trashBin: false, archivedAt: null, autoDeleteAt: null, updatedBy: actor.sub },
        include: FACT_SHEET_INCLUDE,
      });
      await tx.trashBinEntry.deleteMany({ where: { factSheetId: id } });
      return result;
    });

    this.events.emit('factsheet.event', {
      eventType: 'FACT_SHEET_UPDATED',
      factSheet: { id: updated.id, type: updated.type.technicalKey, name: updated.name, externalId: updated.externalId },
      actor,
      changes: [{ field: 'status', oldValue: 'ARCHIVED', newValue: 'ACTIVE' }],
    } satisfies FactSheetEvent);

    return updated;
  }

  async permanentDelete(id: string) {
    const factSheet = await this.requireById(id);
    if (!factSheet.trashBin) {
      throw new LeanIxException('INVALID_PATCH', 'Fact sheet must be in the trash bin before it can be permanently deleted', { id });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.relation.deleteMany({ where: { OR: [{ sourceId: id }, { targetId: id }] } });
      await tx.syncMapping.deleteMany({ where: { factSheetId: id } });
      await tx.syncLog.updateMany({ where: { factSheetId: id }, data: { factSheetId: null } });
      await tx.trashBinEntry.deleteMany({ where: { factSheetId: id } });
      await tx.factSheet.delete({ where: { id } });
    });

    return { id, success: true };
  }

  private validateName(name: string) {
    if (!name || !name.trim()) {
      throw new LeanIxException('INVALID_PATCH', 'name is required');
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new LeanIxException('INVALID_PATCH', `name must be at most ${MAX_NAME_LENGTH} characters`);
    }
  }

  private async assertExternalIdUnique(typeId: string, externalId: string, excludeId?: string) {
    const existing = await this.prisma.factSheet.findFirst({
      where: { typeId, externalId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (existing) {
      throw new LeanIxException('DUPLICATE_EXTERNAL_ID', `externalId "${externalId}" already exists for this fact sheet type`, {
        externalId,
      });
    }
  }

  private async applyTagsWithinTx(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0], factSheetId: string, tags: BaseFactSheetInput['tags']) {
    for (const tagInput of tags ?? []) {
      if (!tagInput?.name) continue;
      const groupName = tagInput.group?.name ?? 'default';
      const group = await tx.tagGroup.upsert({
        where: { name: groupName },
        update: {},
        create: { name: groupName },
      });
      const tag = await tx.tag.upsert({
        where: { groupId_name: { groupId: group.id, name: tagInput.name } },
        update: {},
        create: { groupId: group.id, name: tagInput.name },
      });
      await tx.tagAssignment.upsert({
        where: { factSheetId_tagId: { factSheetId, tagId: tag.id } },
        update: {},
        create: { factSheetId, tagId: tag.id },
      });
    }
  }

  private async applySubscriptionsWithinTx(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    factSheetId: string,
    subscriptions: BaseFactSheetInput['subscriptions'],
  ) {
    for (const sub of subscriptions ?? []) {
      if (!sub?.user) continue;
      const email = sub.user.email ?? `${sub.user.id ?? 'unknown'}@mock.local`;
      const user = await tx.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          name: sub.user.name ?? email,
          workspaceId: 'ws-development',
        },
      });
      await tx.subscription.upsert({
        where: { factSheetId_userId_type: { factSheetId, userId: user.id, type: sub.type } },
        update: { roles: sub.roles ?? [] },
        create: {
          factSheetId,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          type: sub.type,
          roles: sub.roles ?? [],
        },
      });
    }
  }

  async recalculateCompletionWithinTx(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    factSheetId: string,
    factSheetTypeId: string,
  ) {
    const [factSheet, mandatoryAttributes, attributeValues] = await Promise.all([
      tx.factSheet.findUniqueOrThrow({ where: { id: factSheetId } }),
      tx.attribute.findMany({ where: { factSheetTypeId, mandatory: true } }),
      tx.attributeValue.findMany({ where: { factSheetId }, include: { attribute: true } }),
    ]);

    if (mandatoryAttributes.length === 0) {
      return;
    }

    const nativeValues: Record<string, unknown> = {
      name: factSheet.name,
      description: factSheet.description,
      externalId: factSheet.externalId,
      lifecycle: factSheet.lifecycle,
    };
    const valueByKey = new Map<string, unknown>();
    for (const key of Object.keys(nativeValues)) {
      valueByKey.set(key, nativeValues[key]);
    }
    for (const av of attributeValues) {
      valueByKey.set(av.attribute.technicalKey, av.value);
    }

    const filled = mandatoryAttributes.filter((attr) => this.isFilled(valueByKey.get(attr.technicalKey))).length;
    const completion = Math.round((filled / mandatoryAttributes.length) * 1000) / 10;

    await tx.factSheet.update({ where: { id: factSheetId }, data: { completion } });
  }

  private isFilled(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  private async buildWhere(filter?: FilterInput) {
    const where: Record<string, unknown> = { trashBin: false };

    if (!filter) return where;

    if (filter.status) {
      where.status = filter.status;
      if (filter.status === 'ARCHIVED') {
        delete where.trashBin;
      }
    }

    if (filter.factSheetType) {
      const type = await this.metaModel.requireTypeByKey(filter.factSheetType);
      where.typeId = type.id;
    }

    if (filter.fieldFilters?.length) {
      const AND: Record<string, unknown>[] = [];
      for (const ff of filter.fieldFilters) {
        AND.push(this.fieldFilterToWhere(ff));
      }
      where.AND = AND;
    }

    if (filter.relationFilters?.length) {
      const AND = (where.AND as Record<string, unknown>[]) ?? [];
      for (const rf of filter.relationFilters) {
        AND.push({
          OR: [
            {
              sourceRelations: {
                some: {
                  relationType: { technicalKey: rf.relationType },
                  ...(rf.targetId ? { targetId: rf.targetId } : {}),
                  ...(rf.targetType ? { target: { type: { technicalKey: rf.targetType } } } : {}),
                },
              },
            },
            {
              targetRelations: {
                some: {
                  relationType: { technicalKey: rf.relationType },
                  ...(rf.targetId ? { sourceId: rf.targetId } : {}),
                },
              },
            },
          ],
        });
      }
      where.AND = AND;
    }

    return where;
  }

  private fieldFilterToWhere(ff: { key: string; values: string[]; operator?: string }): Record<string, unknown> {
    if (NON_ATTRIBUTE_KEYS.has(ff.key) && ff.key !== 'lifecycle') {
      const mode = 'insensitive' as const;
      switch (ff.operator) {
        case 'CONTAINS':
          return { [ff.key]: { contains: ff.values[0], mode } };
        case 'STARTS_WITH':
          return { [ff.key]: { startsWith: ff.values[0], mode } };
        case 'ENDS_WITH':
          return { [ff.key]: { endsWith: ff.values[0], mode } };
        case 'IN':
        case 'NOT_IN': {
          const clause = { [ff.key]: { in: ff.values, mode } };
          return ff.operator === 'NOT_IN' ? { NOT: clause } : clause;
        }
        default:
          return { [ff.key]: { equals: ff.values[0], mode } };
      }
    }

    return {
      attributes: {
        some: {
          attribute: { technicalKey: ff.key },
          value: { equals: ff.values.length === 1 ? ff.values[0] : ff.values },
        },
      },
    };
  }

  private buildOrderBy(sort?: SortInput) {
    if (!sort || sort.mode === 'BY_UPDATED_AT') {
      return { updatedAt: (sort?.direction ?? 'DESC').toLowerCase() as 'asc' | 'desc' };
    }
    if (sort.mode === 'BY_NAME') {
      return { name: (sort.direction ?? 'ASC').toLowerCase() as 'asc' | 'desc' };
    }
    const key = sort.key ?? 'updatedAt';
    if (['name', 'description', 'externalId', 'status', 'completion', 'updatedAt', 'createdAt'].includes(key)) {
      return { [key]: (sort.direction ?? 'ASC').toLowerCase() as 'asc' | 'desc' };
    }
    return { updatedAt: 'desc' as const };
  }
}
