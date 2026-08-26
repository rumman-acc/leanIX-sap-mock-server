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
  async createFactSheet(@Args('input') input: BaseFactSheetInput, @CurrentUser() user: JwtClaims) {
    const factSheet = await this.factSheetService.create(input, user);
    return { factSheet, errors: [] };
  }

  @Mutation('updateFactSheet')
  async updateFactSheet(@Args('id') id: string, @Args('patches') patches: Patch[], @CurrentUser() user: JwtClaims) {
    const factSheet = await this.patchService.update(id, patches, user);
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

  @ResolveField('type')
  type(@Parent() factSheet: FactSheetRecord) {
    return factSheet.type.technicalKey;
  }

  @ResolveField('lxState')
  lxState(@Parent() factSheet: FactSheetRecord) {
    return factSheet.qualitySeal === 'APPROVED' ? 'APPROVED' : 'BROKEN_QUALITY_SEAL';
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
