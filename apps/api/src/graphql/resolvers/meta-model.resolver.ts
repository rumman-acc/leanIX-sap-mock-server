import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { MetaModelService } from '../../meta-model/meta-model.service';

type FactSheetTypeRecord = {
  technicalKey: string;
  attributes?: unknown[];
  relationsAsSource?: unknown[];
};

@Resolver('FactSheetType')
export class MetaModelResolver {
  constructor(private readonly metaModel: MetaModelService) {}

  @Query('allFactSheetTypes')
  allFactSheetTypes() {
    return this.metaModel.findAllTypes();
  }

  @Query('factSheetType')
  factSheetType(@Args('technicalKey') technicalKey: string) {
    return this.metaModel.findTypeByKey(technicalKey);
  }

  @ResolveField('fields')
  async fields(@Parent() type: FactSheetTypeRecord) {
    if (type.attributes) return type.attributes;
    const full = await this.metaModel.findTypeByKey(type.technicalKey);
    return full?.attributes ?? [];
  }

  @ResolveField('relations')
  async relations(@Parent() type: FactSheetTypeRecord) {
    if (type.relationsAsSource) return type.relationsAsSource;
    const full = await this.metaModel.findTypeByKey(type.technicalKey);
    return full?.relationsAsSource ?? [];
  }
}
