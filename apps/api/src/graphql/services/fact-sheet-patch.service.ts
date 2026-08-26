import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtClaims, LIFECYCLE_PHASES, Patch, parseRelationPatchPath } from '@leanix-mock/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeanIxException } from '../../common/exceptions/leanix.exception';
import { MetaModelService } from '../../meta-model/meta-model.service';
import { INTERACTIVE_TX_OPTIONS } from '../../common/prisma/transaction-options';
import { FactSheetEvent, FactSheetService } from './fact-sheet.service';

const NATIVE_FIELD_PATHS = new Set(['/name', '/description', '/externalId', '/lifecycle']);
type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class FactSheetPatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaModel: MetaModelService,
    private readonly events: EventEmitter2,
    private readonly factSheetService: FactSheetService,
  ) {}

  async update(id: string, patches: Patch[], actor: JwtClaims) {
    const before = await this.factSheetService.requireById(id);
    const changes: FactSheetEvent['changes'] = [];
    const relationsCreated: FactSheetEvent['relation'][] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const patch of patches) {
        if (!['add', 'replace', 'remove'].includes(patch.op)) {
          throw new LeanIxException('INVALID_PATCH', `Unsupported patch operation "${patch.op}"`);
        }
        if (!patch.path || !patch.path.startsWith('/')) {
          throw new LeanIxException('INVALID_PATCH', `Invalid patch path "${patch.path}"`);
        }

        if (NATIVE_FIELD_PATHS.has(patch.path)) {
          await this.applyNativeFieldPatch(tx, id, patch, changes);
        } else if (patch.path.startsWith('/lifecycle/')) {
          await this.applyLifecyclePhasePatch(tx, id, patch, changes);
        } else if (patch.path === '/qualitySeal') {
          await this.applyQualitySealPatch(tx, id, patch, changes);
        } else if (patch.path === '/tags' || patch.path.startsWith('/tags/')) {
          await this.applyTagPatch(tx, id, patch);
        } else if (patch.path.startsWith('/rel')) {
          const created = await this.applyRelationPatch(tx, id, before.type.technicalKey, patch);
          if (created) relationsCreated.push(created);
        } else {
          await this.applyCustomAttributePatch(tx, id, before.type.id, patch);
        }
      }

      await tx.factSheet.update({ where: { id }, data: { updatedBy: actor.sub } });
      await this.factSheetService.recalculateCompletionWithinTx(tx, id, before.typeId);
    }, INTERACTIVE_TX_OPTIONS);

    const after = await this.factSheetService.requireById(id);

    if (changes.length > 0) {
      this.events.emit('factsheet.event', {
        eventType: 'FACT_SHEET_UPDATED',
        factSheet: { id: after.id, type: after.type.technicalKey, name: after.name, externalId: after.externalId },
        actor,
        changes,
      } satisfies FactSheetEvent);

      for (const change of changes) {
        this.events.emit('factsheet.event', {
          eventType: 'FACT_SHEET_FIELD_UPDATED',
          factSheet: { id: after.id, type: after.type.technicalKey, name: after.name, externalId: after.externalId },
          actor,
          changes: [change],
        } satisfies FactSheetEvent);
      }
    }

    for (const relation of relationsCreated) {
      if (!relation) continue;
      this.events.emit('factsheet.event', {
        eventType: 'RELATION_CREATED',
        factSheet: { id: after.id, type: after.type.technicalKey, name: after.name, externalId: after.externalId },
        actor,
        changes: [],
        relation,
      } satisfies FactSheetEvent);
    }

    return after;
  }

  private async applyNativeFieldPatch(tx: PrismaTx, id: string, patch: Patch, changes: FactSheetEvent['changes']) {
    if (patch.op === 'remove') {
      throw new LeanIxException('INVALID_PATCH', `remove is not supported for path "${patch.path}"`);
    }

    const current = await tx.factSheet.findUniqueOrThrow({ where: { id } });
    const field = patch.path.slice(1) as 'name' | 'description' | 'externalId' | 'lifecycle';
    let value: unknown = patch.value;

    if (field === 'name' && (!value || typeof value !== 'string' || !(value as string).trim())) {
      throw new LeanIxException('INVALID_PATCH', 'name cannot be empty');
    }
    if (field === 'name' && (value as string).length > 255) {
      throw new LeanIxException('INVALID_PATCH', 'name must be at most 255 characters');
    }

    if (field === 'lifecycle' && typeof value === 'string') {
      // Real LeanIX sends a full-replace lifecycle value as a JSON-encoded string, not an
      // inline object — see docs/RESEARCH_LEANIX_REAL_API.md §4.
      try {
        value = JSON.parse(value);
      } catch {
        throw new LeanIxException('INVALID_PATCH', 'lifecycle value must be a JSON object or a JSON-encoded string');
      }
    }

    if (field === 'externalId') {
      // Real LeanIX's externalId is a structured { type, externalId } object (see
      // docs/RESEARCH_LEANIX_REAL_API.md §4); this mock still stores/compares it as a plain
      // string internally, so unwrap the object form if given.
      if (value && typeof value === 'object' && 'externalId' in (value as Record<string, unknown>)) {
        value = (value as { externalId: unknown }).externalId;
      }
      if (value) {
        const existing = await tx.factSheet.findFirst({
          where: { typeId: current.typeId, externalId: value as string, id: { not: id } },
        });
        if (existing) {
          throw new LeanIxException('DUPLICATE_EXTERNAL_ID', `externalId "${value}" already exists for this fact sheet type`);
        }
      }
    }

    const oldValue = field === 'lifecycle' ? current.lifecycle : (current as Record<string, unknown>)[field];
    if (oldValue !== value) {
      changes.push({ field, oldValue, newValue: value });
    }

    const data: Record<string, unknown> = { [field]: value };
    if (field === 'name') {
      data.displayName = value;
    }
    await tx.factSheet.update({ where: { id }, data });
  }

  /**
   * Real LeanIX patches one lifecycle phase at a time via /lifecycle/{phaseName} (e.g.
   * /lifecycle/phaseIn), value = a plain date string — not the whole-object replace this mock
   * originally only supported at /lifecycle. See docs/RESEARCH_LEANIX_REAL_API.md §4.
   */
  private async applyLifecyclePhasePatch(tx: PrismaTx, id: string, patch: Patch, changes: FactSheetEvent['changes']) {
    if (patch.op === 'remove') {
      throw new LeanIxException('INVALID_PATCH', `remove is not supported for path "${patch.path}"`);
    }
    const phaseName = patch.path.slice('/lifecycle/'.length);
    if (!LIFECYCLE_PHASES.includes(phaseName as (typeof LIFECYCLE_PHASES)[number])) {
      throw new LeanIxException('INVALID_PATCH', `Unknown lifecycle phase "${phaseName}"`);
    }

    const current = await tx.factSheet.findUniqueOrThrow({ where: { id } });
    const lifecycle = (current.lifecycle as { asString?: string; phases?: Array<{ phase: string; startDate: string | null }> } | null) ?? {
      phases: [],
    };
    const phases = lifecycle.phases ?? [];
    const existingPhase = phases.find((p) => p.phase === phaseName);
    const oldStartDate = existingPhase?.startDate ?? null;

    const updatedPhases = existingPhase
      ? phases.map((p) => (p.phase === phaseName ? { ...p, startDate: patch.value as string } : p))
      : [...phases, { phase: phaseName, startDate: patch.value as string }];

    if (oldStartDate !== patch.value) {
      changes.push({ field: `lifecycle.${phaseName}`, oldValue: oldStartDate, newValue: patch.value });
    }

    await tx.factSheet.update({
      where: { id },
      data: { lifecycle: { ...lifecycle, phases: updatedPhases } as any },
    });
  }

  /**
   * Real LeanIX allows manually patching the quality seal (this mock previously only ever
   * auto-set it to BROKEN on create). Accepts both this mock's own enum casing
   * (APPROVED/BROKEN) and the lowercase form seen in a real documented patch example
   * ("approve"/"broken") — see docs/RESEARCH_LEANIX_REAL_API.md §4.
   */
  private async applyQualitySealPatch(tx: PrismaTx, id: string, patch: Patch, changes: FactSheetEvent['changes']) {
    if (patch.op === 'remove') {
      throw new LeanIxException('INVALID_PATCH', 'remove is not supported for path "/qualitySeal"');
    }
    const normalized = String(patch.value).toUpperCase();
    const qualitySeal = normalized === 'APPROVE' || normalized === 'APPROVED' ? 'APPROVED' : normalized === 'BROKEN' ? 'BROKEN' : null;
    if (!qualitySeal) {
      throw new LeanIxException('INVALID_PATCH', `Invalid qualitySeal value "${patch.value}" — expected APPROVED/approve or BROKEN/broken`);
    }

    const current = await tx.factSheet.findUniqueOrThrow({ where: { id } });
    if (current.qualitySeal !== qualitySeal) {
      changes.push({ field: 'qualitySeal', oldValue: current.qualitySeal, newValue: qualitySeal });
    }
    await tx.factSheet.update({ where: { id }, data: { qualitySeal } });
  }

  private async applyTagPatch(tx: PrismaTx, factSheetId: string, patch: Patch) {
    if (patch.op === 'add' && patch.path === '/tags') {
      const value = patch.value as { name?: string; group?: { name?: string } } | undefined;
      if (!value?.name) {
        throw new LeanIxException('INVALID_PATCH', 'tag add requires a value with a "name" field');
      }
      const groupName = value.group?.name ?? 'default';
      const group = await tx.tagGroup.upsert({ where: { name: groupName }, update: {}, create: { name: groupName } });
      const tag = await tx.tag.upsert({
        where: { groupId_name: { groupId: group.id, name: value.name } },
        update: {},
        create: { groupId: group.id, name: value.name },
      });
      await tx.tagAssignment.upsert({
        where: { factSheetId_tagId: { factSheetId, tagId: tag.id } },
        update: {},
        create: { factSheetId, tagId: tag.id },
      });
      return;
    }

    if (patch.op === 'remove' && patch.path.startsWith('/tags/')) {
      const tagId = patch.path.split('/')[2];
      await tx.tagAssignment.deleteMany({ where: { factSheetId, tagId } });
      return;
    }

    throw new LeanIxException('INVALID_PATCH', `Unsupported tag patch: ${patch.op} ${patch.path}`);
  }

  private async applyRelationPatch(
    tx: PrismaTx,
    factSheetId: string,
    sourceTypeKey: string,
    patch: Patch,
  ): Promise<FactSheetEvent['relation'] | null> {
    const parsed = parseRelationPatchPath(patch.path);
    if (!parsed) {
      throw new LeanIxException('INVALID_PATCH', `Invalid relation patch path "${patch.path}"`);
    }

    const relationType = await this.metaModel.requireRelationTypeByKey(parsed.relationTypeKey);

    if (patch.op === 'add') {
      if (parsed.relationId) {
        throw new LeanIxException('INVALID_PATCH', 'add must not include a relation instance id in the path');
      }
      const targetId = patch.value as string;
      if (!targetId) {
        throw new LeanIxException('INVALID_PATCH', 'add relation requires a target fact sheet id as value');
      }
      const target = await tx.factSheet.findUnique({ where: { id: targetId }, include: { type: true } });
      if (!target) {
        throw new LeanIxException('FACT_SHEET_NOT_FOUND', `Target fact sheet "${targetId}" does not exist`);
      }
      const relation = await tx.relation.upsert({
        where: { relationTypeId_sourceId_targetId: { relationTypeId: relationType.id, sourceId: factSheetId, targetId } },
        update: {},
        create: { relationTypeId: relationType.id, sourceId: factSheetId, targetId },
      });
      return {
        id: relation.id,
        type: relationType.technicalKey,
        target: { id: target.id, type: target.type.technicalKey, name: target.name, externalId: target.externalId },
      };
    }

    if (!parsed.relationId) {
      throw new LeanIxException('INVALID_PATCH', `${patch.op} on a relation requires the relation instance id in the path`);
    }

    const existingRelation = await tx.relation.findUnique({ where: { id: parsed.relationId } });
    if (!existingRelation || existingRelation.relationTypeId !== relationType.id) {
      throw new LeanIxException('RELATION_NOT_FOUND', `Relation "${parsed.relationId}" does not exist`);
    }

    if (patch.op === 'remove') {
      await tx.relation.delete({ where: { id: parsed.relationId } });
      return null;
    }

    if (patch.op === 'replace') {
      const targetId = patch.value as string;
      const target = await tx.factSheet.findUnique({ where: { id: targetId } });
      if (!target) {
        throw new LeanIxException('FACT_SHEET_NOT_FOUND', `Target fact sheet "${targetId}" does not exist`);
      }
      await tx.relation.update({ where: { id: parsed.relationId }, data: { targetId } });
      return null;
    }

    throw new LeanIxException('INVALID_PATCH', `Unsupported relation patch operation "${patch.op}"`);
  }

  private async applyCustomAttributePatch(tx: PrismaTx, factSheetId: string, factSheetTypeId: string, patch: Patch) {
    const technicalKey = patch.path.slice(1);
    const attribute = await tx.attribute.findFirst({ where: { factSheetTypeId, technicalKey } });
    if (!attribute) {
      throw new LeanIxException('INVALID_PATCH', `Unknown attribute path "${patch.path}"`);
    }

    if (patch.op === 'remove') {
      await tx.attributeValue.deleteMany({ where: { factSheetId, attributeId: attribute.id } });
      return;
    }

    await tx.attributeValue.upsert({
      where: { factSheetId_attributeId: { factSheetId, attributeId: attribute.id } },
      update: { value: patch.value as any },
      create: { factSheetId, attributeId: attribute.id, value: patch.value as any },
    });
  }
}
