import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { LeanIxException } from '../common/exceptions/leanix.exception';

const FACT_SHEET_TYPE_INCLUDE = {
  attributes: { include: { allowedValues: true } },
  relationsAsSource: { include: { targetType: true, sourceType: true } },
} as const;

@Injectable()
export class MetaModelService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllTypes() {
    return this.prisma.factSheetType.findMany({
      where: { enabled: true },
      include: FACT_SHEET_TYPE_INCLUDE,
      orderBy: { technicalKey: 'asc' },
    });
  }

  async findTypeByKey(technicalKey: string) {
    return this.prisma.factSheetType.findUnique({
      where: { technicalKey },
      include: FACT_SHEET_TYPE_INCLUDE,
    });
  }

  async requireTypeByKey(technicalKey: string) {
    const type = await this.findTypeByKey(technicalKey);
    if (!type) {
      throw new LeanIxException('FACT_SHEET_TYPE_NOT_FOUND', `Fact sheet type "${technicalKey}" does not exist`);
    }
    return type;
  }

  async findRelationTypeByKey(technicalKey: string) {
    return this.prisma.relationType.findFirst({
      where: { technicalKey },
      include: { sourceType: true, targetType: true },
    });
  }

  async requireRelationTypeByKey(technicalKey: string) {
    const relationType = await this.findRelationTypeByKey(technicalKey);
    if (!relationType) {
      throw new LeanIxException('RELATION_NOT_FOUND', `Relation type "${technicalKey}" does not exist`);
    }
    return relationType;
  }

  async findMandatoryAttributes(factSheetTypeId: string) {
    return this.prisma.attribute.findMany({
      where: { factSheetTypeId, mandatory: true },
    });
  }
}
