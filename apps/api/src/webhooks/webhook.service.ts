import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { WebhookConfig, WebhookEvent, WebhookPayload, WEBHOOK_EVENTS } from '@leanix-mock/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { LeanIxException } from '../common/exceptions/leanix.exception';
import { generateId, IdPrefix } from '../common/utils/id-generator';
import { LeanIxConfig } from '../config/leanix.config';
import { FactSheetEvent } from '../graphql/services/fact-sheet.service';
import { WEBHOOK_DELIVERY_QUEUE, WebhookDeliveryJobData } from './webhook.constants';

const WORKSPACE_ID = 'ws-development';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE) private readonly queue: Queue<WebhookDeliveryJobData>,
  ) {}

  async register(config: WebhookConfig) {
    if (!config.url) {
      throw new LeanIxException('INVALID_LDIF', 'url is required to register a webhook');
    }
    const invalidEvents = (config.events ?? []).filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      throw new LeanIxException('INVALID_LDIF', `Unsupported webhook event(s): ${invalidEvents.join(', ')}`);
    }

    return this.prisma.webhook.create({
      data: {
        id: generateId(IdPrefix.WEBHOOK),
        url: config.url,
        events: config.events ?? [],
        secret: config.secret ?? randomBytes(24).toString('hex'),
        active: true,
        workspaceId: WORKSPACE_ID,
      },
    });
  }

  async list() {
    return this.prisma.webhook.findMany({ where: { workspaceId: WORKSPACE_ID }, orderBy: { createdAt: 'desc' } });
  }

  async remove(id: string) {
    await this.prisma.webhook.delete({ where: { id } }).catch(() => undefined);
    return { id, success: true };
  }

  @OnEvent('factsheet.event')
  async handleFactSheetEvent(event: FactSheetEvent): Promise<void> {
    const config = this.configService.get<LeanIxConfig>('leanix')!;
    if (!config.webhookDeliveryEnabled) return;

    const webhooks = await this.prisma.webhook.findMany({
      where: { workspaceId: WORKSPACE_ID, active: true, events: { has: event.eventType } },
    });
    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
      eventType: event.eventType,
      factSheet: event.factSheet,
      ...(event.relation ? { relation: event.relation } : {}),
      user: { id: event.actor.sub, name: event.actor.userName, email: event.actor.userName },
      workspace: { id: event.actor.workspaceId, name: event.actor.workspaceName },
      timestamp: new Date().toISOString(),
      changes: event.changes,
    };

    for (const webhook of webhooks) {
      const deliveryId = randomUUID();
      await this.queue.add(
        'deliver',
        { webhookId: webhook.id, deliveryId, eventType: event.eventType, payload, attemptNumber: 1 },
        { jobId: `${deliveryId}-1` },
      );
      this.logger.debug(`Queued webhook delivery ${deliveryId} for webhook ${webhook.id} (${event.eventType})`);
    }
  }
}
