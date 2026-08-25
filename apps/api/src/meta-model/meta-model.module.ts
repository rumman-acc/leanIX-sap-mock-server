import { Module } from '@nestjs/common';
import { MetaModelService } from './meta-model.service';

@Module({
  providers: [MetaModelService],
  exports: [MetaModelService],
})
export class MetaModelModule {}
