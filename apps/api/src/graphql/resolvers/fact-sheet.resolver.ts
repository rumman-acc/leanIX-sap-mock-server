import { Args, Parent, Query, Mutation, ResolveField, Resolver } from '@nestjs/graphql';
import { BaseFactSheetInput, FilterInput, Patch, SortInput } from '@leanix-mock/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtClaims } from '@leanix-mock/shared';
import { FactSheetService } from '../services/fact-sheet.service';
import { FactSheetPatchService } from '../services/fact-sheet-patch.service';

// Field resolvers for the fact sheet's common (BaseFactSheet interface) fields live in
// base-fact-sheet.fields.ts, registered per concrete implementing type via the raw `resolvers` map
// passed to GraphQLModule.forRoot() — see docs/RESEARCH_LEANIX_REAL_API.md §7 for why. This class
// only handles Query/Mutation, which don't need a type-name resolver context.
@Resolver()
export class FactSheetResolver {
  constructor(
    private readonly factSheetService: FactSheetService,
    private readonly patchService: FactSheetPatchService,
  ) {}

  @Query('factSheet')
  factSheet(@Args('id') id: string, @CurrentUser() user: JwtClaims) {
    return this.factSheetService.findById(id, user.workspaceId);
  }

  @Query('allFactSheets')
  allFactSheets(
    @Args('filter') filter: FilterInput | undefined,
    @Args('sort') sort: SortInput | undefined,
    @Args('first') first: number | undefined,
    @Args('after') after: string | undefined,
    @CurrentUser() user: JwtClaims,
  ) {
    return this.factSheetService.findMany({ filter, sort, first, after }, user.workspaceId);
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
  deleteFactSheet(@Args('id') id: string, @CurrentUser() user: JwtClaims) {
    return this.factSheetService.permanentDelete(id, user);
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
  deleteRelation(@Args('id') id: string, @CurrentUser() user: JwtClaims) {
    return this.factSheetService.deleteRelation(id, user);
  }
}

@Resolver('FactSheetConnection')
export class FactSheetConnectionResolver {
  constructor(private readonly factSheetService: FactSheetService) {}

  @ResolveField('filterOptions')
  filterOptions(@CurrentUser() user: JwtClaims) {
    return this.factSheetService.getFilterOptions(user.workspaceId);
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
