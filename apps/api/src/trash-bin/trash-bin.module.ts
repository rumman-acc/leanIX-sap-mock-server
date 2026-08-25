import { Module } from '@nestjs/common';
import { GraphqlModule } from '../graphql/graphql.module';
import { TrashBinService } from './trash-bin.service';
import { TrashBinScheduler } from './trash-bin.scheduler';

@Module({
  imports: [GraphqlModule],
  providers: [TrashBinService, TrashBinScheduler],
  exports: [TrashBinService],
})
export class TrashBinModule {}
