import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { JwtClaims } from '@leanix-mock/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MetaModelService } from '../../meta-model/meta-model.service';

type FactSheetTypeRecord = {
  technicalKey: string;
  workspaceId: string;
  attributes?: unknown[];
  relationsAsSource?: unknown[];
};

@Resolver('FactSheetType')
export class MetaModelResolver {
  constructor(private readonly metaModel: MetaModelService) {}

  @Query('allFactSheetTypes')
  allFactSheetTypes(@CurrentUser() user: JwtClaims) {
    return this.metaModel.findAllTypes(user.workspaceId);
  }

  @Query('factSheetType')
  factSheetType(@Args('technicalKey') technicalKey: string, @CurrentUser() user: JwtClaims) {
    return this.metaModel.findTypeByKey(user.workspaceId, technicalKey);
  }

  @ResolveField('fields')
  async fields(@Parent() type: FactSheetTypeRecord) {
    if (type.attributes) return type.attributes;
    const full = await this.metaModel.findTypeByKey(type.workspaceId, type.technicalKey);
    return full?.attributes ?? [];
  }

  @ResolveField('relations')
  async relations(@Parent() type: FactSheetTypeRecord) {
    if (type.relationsAsSource) return type.relationsAsSource;
    const full = await this.metaModel.findTypeByKey(type.workspaceId, type.technicalKey);
    return full?.relationsAsSource ?? [];
  }
}
