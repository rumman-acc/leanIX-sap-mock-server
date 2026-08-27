import { Args, Parent, Query, Mutation, ResolveField, Resolver } from '@nestjs/graphql';
import { BaseFactSheetInput, FilterInput, Patch, SortInput } from '@leanix-mock/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtClaims } from '@leanix-mock/shared';
import { FactSheetService } from '../services/fact-sheet.service';
import { FactSheetPatchService } from '../services/fact-sheet-patch.service';

type FactSheetRecord = Awaited<ReturnType<FactSheetService['requireById']>>;

@Resolver('FactSheet')
export class FactSheetResolver {
  constructor(
    private readonly factSheetService: FactSheetService,
    private readonly patchService: FactSheetPatchService,
  ) {}

  @Query('factSheet')
  factSheet(@Args('id') id: string) {
    return this.factSheetService.findById(id);
  }

  @Query('allFactSheets')
  allFactSheets(
    @Args('filter') filter?: FilterInput,
    @Args('sort') sort?: SortInput,
    @Args('first') first?: number,
    @Args('after') after?: string,
  ) {
    return this.factSheetService.findMany({ filter, sort, first, after });
  }

  @Mutation('createFactSheet')
  async createFactSheet(
    @Args('input') input: BaseFactSheetInput,
    @Args('patches') patches: Patch[] | undefined,
    @CurrentUser() user: JwtClaims,
  ) {
    let factSheet = await this.factSheetService.create(input, user);
    // Real LeanIX's createFactSheet accepts input + patches together in one call — see
    // docs/RESEARCH_LEANIX_REAL_API.md §6. Applying patches right after create reuses the same
    // validated patch logic updateFactSheet uses, no duplicated business logic.
    if (patches?.length) {
      factSheet = await this.patchService.update(factSheet.id, patches, user);
    }
    return { factSheet, errors: [] };
  }

  @Mutation('updateFactSheet')
  async updateFactSheet(
    @Args('id') id: string,
    @Args('rev') rev: number | undefined,
    @Args('patches') patches: Patch[],
    @Args('comment') comment: string | undefined,
    @Args('validateOnly') validateOnly: boolean | undefined,
    @CurrentUser() user: JwtClaims,
  ) {
    const factSheet = await this.patchService.update(id, patches, user, { rev, comment, validateOnly });
    return { factSheet, errors: [] };
  }

  @Mutation('archiveFactSheet')
  async archiveFactSheet(@Args('id') id: string, @CurrentUser() user: JwtClaims) {
    const factSheet = await this.factSheetService.archive(id, user);
    return { factSheet, errors: [] };
  }

  @Mutation('reviveFactSheet')
  async reviveFactSheet(@Args('id') id: string, @CurrentUser() user: JwtClaims) {
    const factSheet = await this.factSheetService.revive(id, user);
    return { factSheet, errors: [] };
  }

  @Mutation('deleteFactSheet')
  deleteFactSheet(@Args('id') id: string) {
    return this.factSheetService.permanentDelete(id);
  }

  @Mutation('upsertRelation')
  upsertRelation(
    @Args('from') from: string,
    @Args('to') to: string,
    @Args('type') type: string,
    @Args('description') description: string | undefined,
    @CurrentUser() user: JwtClaims,
  ) {
    return this.factSheetService.upsertRelation(from, to, type, description, user);
  }

  @Mutation('deleteRelation')
  deleteRelation(@Args('id') id: string) {
    return this.factSheetService.deleteRelation(id);
  }

  @ResolveField('type')
  type(@Parent() factSheet: FactSheetRecord) {
    return factSheet.type.technicalKey;
  }

  @ResolveField('lxState')
  lxState(@Parent() factSheet: FactSheetRecord) {
    // Real LeanIX's lxState naming only diverges from qualitySeal for BROKEN (-> BROKEN_QUALITY_SEAL);
    // APPROVED/DRAFT/REJECTED are spelled the same in both — see docs/RESEARCH_LEANIX_REAL_API.md §6.
    return factSheet.qualitySeal === 'BROKEN' ? 'BROKEN_QUALITY_SEAL' : factSheet.qualitySeal;
  }

  @ResolveField('lifecycle')
  lifecycle(@Parent() factSheet: FactSheetRecord) {
    const lifecycle = factSheet.lifecycle as { asString?: string; phases?: unknown[] } | null;
    if (!lifecycle) return null;
    return { asString: lifecycle.asString ?? null, phases: lifecycle.phases ?? [] };
  }

  @ResolveField('tags')
  tags(@Parent() factSheet: FactSheetRecord) {
    return (factSheet.tags ?? []).map((assignment) => ({
      id: assignment.tag.id,
      name: assignment.tag.name,
      color: assignment.tag.color,
      group: assignment.tag.group,
    }));
  }

  @ResolveField('subscriptions')
  subscriptions(@Parent() factSheet: FactSheetRecord) {
    return (factSheet.subscriptions ?? []).map((sub) => ({
      id: sub.id,
      type: sub.type,
      roles: sub.roles,
      user: { id: sub.userId, name: sub.userName, email: sub.userEmail },
    }));
  }

  @ResolveField('attributes')
  attributes(@Parent() factSheet: FactSheetRecord) {
    return (factSheet.attributes ?? []).map((av) => ({
      id: av.id,
      value: av.value,
      attribute: av.attribute,
    }));
  }

  @ResolveField('relations')
  relations(@Parent() factSheet: FactSheetRecord) {
    const asSource = (factSheet.sourceRelations ?? []).map((relation) => ({
      id: relation.id,
      description: relation.description,
      relationType: relation.relationType,
      source: factSheet,
      target: relation.target,
    }));
    const asTarget = (factSheet.targetRelations ?? []).map((relation) => ({
      id: relation.id,
      description: relation.description,
      relationType: relation.relationType,
      source: relation.source,
      target: factSheet,
    }));
    return [...asSource, ...asTarget];
  }
}

@Resolver('FactSheetConnection')
export class FactSheetConnectionResolver {
  constructor(private readonly factSheetService: FactSheetService) {}

  @ResolveField('filterOptions')
  filterOptions() {
    return this.factSheetService.getFilterOptions();
  }
}

@Resolver('Relation')
export class RelationFieldResolver {
  @ResolveField('relationType')
  relationType(@Parent() relation: { relationType: unknown }) {
    return relation.relationType;
  }
}

@Resolver('RelationType')
export class RelationTypeFieldResolver {
  @ResolveField('sourceType')
  sourceType(@Parent() relationType: { sourceType: unknown }) {
    return relationType.sourceType;
  }

  @ResolveField('targetType')
  targetType(@Parent() relationType: { targetType: unknown }) {
    return relationType.targetType;
  }
}
