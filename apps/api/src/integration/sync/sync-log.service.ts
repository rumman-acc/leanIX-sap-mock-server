import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type SyncLogLevel = 'INFO' | 'WARNING' | 'ERROR';

@Injectable()
export class SyncLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(syncRunId: string, level: SyncLogLevel, message: string, opts?: { factSheetId?: string; sourceRecordId?: string; details?: unknown }) {
    return this.prisma.syncLog.create({
      data: {
        syncRunId,
        level,
        message,
        factSheetId: opts?.factSheetId,
        sourceRecordId: opts?.sourceRecordId,
        details: (opts?.details as any) ?? undefined,
      },
    });
  }

  async findByRun(syncRunId: string) {
    return this.prisma.syncLog.findMany({ where: { syncRunId }, orderBy: { createdAt: 'asc' } });
  }
}
