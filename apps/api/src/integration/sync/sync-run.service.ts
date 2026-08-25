import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeanIxException } from '../../common/exceptions/leanix.exception';
import { LDIF } from '@leanix-mock/shared';

@Injectable()
export class SyncRunService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ldif: Pick<LDIF, 'connectorType' | 'connectorId' | 'connectorVersion' | 'processingDirection' | 'processingMode' | 'description'>) {
    return this.prisma.syncRun.create({
      data: {
        connectorType: ldif.connectorType,
        connectorId: ldif.connectorId,
        connectorVersion: ldif.connectorVersion,
        processingDirection: ldif.processingDirection,
        processingMode: ldif.processingMode,
        description: ldif.description,
        status: 'CREATED',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.syncRun.findUnique({ where: { id } });
  }

  async requireById(id: string) {
    const run = await this.findById(id);
    if (!run) {
      throw new LeanIxException('SYNC_RUN_NOT_FOUND', `Sync run "${id}" does not exist`, { id });
    }
    return run;
  }

  async markRunning(id: string) {
    return this.prisma.syncRun.update({ where: { id }, data: { status: 'RUNNING', startedAt: new Date() } });
  }

  async markFinished(id: string, counts: { processedCount: number; createdCount: number; updatedCount: number; deletedCount: number; errorCount: number; warningCount: number }) {
    return this.prisma.syncRun.update({
      where: { id },
      data: { status: counts.errorCount > 0 ? 'FAILED' : 'FINISHED', finishedAt: new Date(), ...counts },
    });
  }

  async markFailed(id: string, errorCount: number) {
    return this.prisma.syncRun.update({ where: { id }, data: { status: 'FAILED', finishedAt: new Date(), errorCount } });
  }
}
