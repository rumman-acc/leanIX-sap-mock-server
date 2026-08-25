import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { IntegrationConfigurationInput, LDIF, LdifUrlInput } from '@leanix-mock/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeanIxException } from '../../common/exceptions/leanix.exception';
import { generateId, IdPrefix } from '../../common/utils/id-generator';
import { LdifValidatorService } from '../../integration/ldif/ldif.validator';
import { LdifProcessor } from '../../integration/ldif/ldif.processor';
import { SyncRunService } from '../../integration/sync/sync-run.service';
import { SyncLogService } from '../../integration/sync/sync-log.service';

const REQUIRED_CONFIG_FIELDS = [
  'name',
  'connectorType',
  'connectorId',
  'connectorVersion',
  'processingDirection',
  'processingMode',
  'processors',
] as const;

@Injectable()
export class IntegrationApiService {
  private readonly logger = new Logger(IntegrationApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ldifValidator: LdifValidatorService,
    private readonly ldifProcessor: LdifProcessor,
    private readonly syncRunService: SyncRunService,
    private readonly syncLogService: SyncLogService,
  ) {}

  async createConfiguration(input: IntegrationConfigurationInput) {
    for (const field of REQUIRED_CONFIG_FIELDS) {
      if (input[field as keyof IntegrationConfigurationInput] === undefined) {
        throw new LeanIxException('INVALID_LDIF', `Configuration field "${field}" is required`);
      }
    }

    return this.prisma.integrationConfiguration.upsert({
      where: { connectorId_connectorType: { connectorId: input.connectorId, connectorType: input.connectorType } },
      update: {
        name: input.name,
        connectorVersion: input.connectorVersion,
        processingDirection: input.processingDirection,
        processingMode: input.processingMode,
        processors: input.processors as any,
      },
      create: {
        id: generateId(IdPrefix.CONFIGURATION),
        name: input.name,
        connectorType: input.connectorType,
        connectorId: input.connectorId,
        connectorVersion: input.connectorVersion,
        processingDirection: input.processingDirection,
        processingMode: input.processingMode,
        processors: input.processors as any,
        status: 'ACTIVE',
      },
    });
  }

  async listConfigurations() {
    return this.prisma.integrationConfiguration.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createSyncRun(payload: unknown) {
    const ldif = this.ldifValidator.assertValid(payload);
    return this.startSyncRun(ldif);
  }

  async createSyncRunFromUrl(payload: LdifUrlInput) {
    const { url, ...header } = payload;
    if (!url) {
      throw new LeanIxException('INVALID_LDIF', 'url is required');
    }

    let content: unknown;
    try {
      const response = await axios.get(url, { timeout: 30_000 });
      content = Array.isArray(response.data) ? response.data : response.data?.content;
    } catch (err) {
      throw new LeanIxException('INVALID_LDIF', `Failed to fetch LDIF content from url: ${(err as Error).message}`);
    }

    const ldif = this.ldifValidator.assertValid({ ...header, content });
    return this.startSyncRun(ldif);
  }

  private async startSyncRun(ldif: LDIF) {
    const run = await this.syncRunService.create(ldif);

    this.ldifProcessor.process(run.id, ldif).catch(async (err) => {
      this.logger.error(`Sync run ${run.id} failed: ${(err as Error).message}`, (err as Error).stack);
      await this.syncLogService.log(run.id, 'ERROR', `Sync run failed: ${(err as Error).message}`);
      await this.syncRunService.markFailed(run.id, 1);
    });

    return { id: run.id, status: run.status, createdAt: run.createdAt };
  }

  async getSyncRun(id: string) {
    const run = await this.syncRunService.requireById(id);
    return {
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      errorCount: run.errorCount,
      warningCount: run.warningCount,
      processedCount: run.processedCount,
      createdCount: run.createdCount,
      updatedCount: run.updatedCount,
      deletedCount: run.deletedCount,
    };
  }

  async getSyncRunLogs(id: string) {
    await this.syncRunService.requireById(id);
    return this.syncLogService.findByRun(id);
  }
}
