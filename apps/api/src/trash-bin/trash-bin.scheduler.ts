import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LeanIxConfig } from '../config/leanix.config';
import { TrashBinService } from './trash-bin.service';
import { FactSheetService } from '../graphql/services/fact-sheet.service';

@Injectable()
export class TrashBinScheduler {
  private readonly logger = new Logger(TrashBinScheduler.name);

  constructor(
    private readonly trashBinService: TrashBinService,
    private readonly factSheetService: FactSheetService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredEntries(): Promise<void> {
    const config = this.configService.get<LeanIxConfig>('leanix')!;
    if (!config.autoDeleteEnabled) {
      return;
    }

    const expired = await this.trashBinService.findExpiredEntries();
    for (const entry of expired) {
      try {
        await this.factSheetService.permanentDelete(entry.factSheetId);
        this.logger.log(`Auto-deleted fact sheet ${entry.factSheetId} after trash-bin retention expired`);
      } catch (err) {
        this.logger.warn(`Failed to auto-delete fact sheet ${entry.factSheetId}: ${(err as Error).message}`);
      }
    }
  }
}
