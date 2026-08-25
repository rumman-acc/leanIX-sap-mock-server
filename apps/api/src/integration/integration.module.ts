import { Module } from '@nestjs/common';
import { MetaModelModule } from '../meta-model/meta-model.module';
import { LdifValidatorService } from './ldif/ldif.validator';
import { LdifProcessor } from './ldif/ldif.processor';
import { SyncRunService } from './sync/sync-run.service';
import { SyncLogService } from './sync/sync-log.service';

@Module({
  imports: [MetaModelModule],
  providers: [LdifValidatorService, LdifProcessor, SyncRunService, SyncLogService],
  exports: [LdifValidatorService, LdifProcessor, SyncRunService, SyncLogService],
})
export class IntegrationModule {}
