import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { WebhookConfig, WebhookEvent, WebhookPayload, WEBHOOK_EVENTS } from '@leanix-mock/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { LeanIxException } from '../common/exceptions/leanix.exception';
import { generateId, IdPrefix } from '../common/utils/id-generator';
import { LeanIxConfig } from '../config/leanix.config';
import { FactSheetEvent } from '../graphql/services/fact-sheet.service';
import { WEBHOOK_DELIVERY_QUEUE, WebhookDeliveryJobData } from './webhook.constants';

const WORKSPACE_ID = 'ws-development';

export interface WebhookSubscriptionResponse<T> {
  status: 'OK';
  data: T;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE) private readonly queue: Queue<WebhookDeliveryJobData>,
  ) {}

  private wrap<T>(data: T): WebhookSubscriptionResponse<T> {
    return { status: 'OK', data };
  }

  async register(config: WebhookConfig) {
    this.validate(config);

    const webhook = await this.prisma.webhook.create({
      data: {
        id: generateId(IdPrefix.WEBHOOK),
        identifier: config.identifier,
        targetUrl: config.targetUrl,
        targetMethod: config.targetMethod ?? 'POST',
        authorizationHeader: config.authorizationHeader,
        callback: config.callback,
        tagSets: (config.tagSets as any) ?? undefined,
        workspaceConstraint: config.workspaceConstraint ?? 'ANY',
        payloadMode: config.payloadMode ?? 'DEFAULT',
        active: config.active ?? true,
        ignoreError: config.ignoreError ?? true,
        events: config.events ?? [],
        secret: config.secret,
        workspaceId: WORKSPACE_ID,
      },
    });
    return this.wrap(webhook);
  }

  async list() {
    const webhooks = await this.prisma.webhook.findMany({ where: { workspaceId: WORKSPACE_ID }, orderBy: { createdAt: 'desc' } });
    return this.wrap(webhooks);
  }

  async findOne(id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook || webhook.workspaceId !== WORKSPACE_ID) {
      throw new NotFoundException(`Webhook subscription "${id}" does not exist`);
    }
    return this.wrap(webhook);
  }

  async update(id: string, config: Partial<WebhookConfig>) {
    await this.findOne(id);
    if (config.identifier === '' || config.targetUrl === '') {
      throw new LeanIxException('INVALID_LDIF', 'identifier and targetUrl cannot be empty');
    }
    if (config.events) {
      this.assertValidEvents(config.events);
    }

    const webhook = await this.prisma.webhook.update({
      where: { id },
      data: {
        identifier: config.identifier,
        targetUrl: config.targetUrl,
        targetMethod: config.targetMethod,
        authorizationHeader: config.authorizationHeader,
        callback: config.callback,
        tagSets: config.tagSets !== undefined ? (config.tagSets as any) : undefined,
        workspaceConstraint: config.workspaceConstraint,
        payloadMode: config.payloadMode,
        active: config.active,
        ignoreError: config.ignoreError,
        events: config.events,
        secret: config.secret,
      },
    });
    return this.wrap(webhook);
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    await this.prisma.webhook.delete({ where: { id } });
    return this.wrap(existing.data);
  }

  private validate(config: WebhookConfig) {
    if (!config.identifier) {
      throw new LeanIxException('INVALID_LDIF', 'identifier is required to register a webhook subscription');
    }
    if (!config.targetUrl) {
      throw new LeanIxException('INVALID_LDIF', 'targetUrl is required to register a webhook subscription');
    }
    this.assertValidEvents(config.events);
  }

  private assertValidEvents(events?: string[]) {
    const invalidEvents = (events ?? []).filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      throw new LeanIxException('INVALID_LDIF', `Unsupported webhook event(s): ${invalidEvents.join(', ')}`);
    }
  }

  @OnEvent('factsheet.event')
  async handleFactSheetEvent(event: FactSheetEvent): Promise<void> {
    const config = this.configService.get<LeanIxConfig>('leanix')!;
    if (!config.webhookDeliveryEnabled) return;

    // Real LeanIX ties webhook delivery to a separately-configured Automation's trigger rules,
    // not an `events` list on the subscription itself (this mock doesn't implement Automations
    // — see docs/RESEARCH_LEANIX_REAL_API.md §2). Closest practical equivalent: a subscription
    // with no `events` configured fires on every fact-sheet event (like an Automation with no
    // narrowing trigger condition); one with `events` set only fires for those (mock-only
    // convenience so tests/integrations can still target specific events).
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        workspaceId: WORKSPACE_ID,
        active: true,
        OR: [{ events: { isEmpty: true } }, { events: { has: event.eventType } }],
      },
    });
    if (webhooks.length === 0) return;

    const matching = await this.filterByTagSets(webhooks, event.factSheet.id);
    if (matching.length === 0) return;

    const payload: WebhookPayload = {
      eventType: event.eventType,
      factSheet: event.factSheet,
      ...(event.relation ? { relation: event.relation } : {}),
      user: { id: event.actor.sub, name: event.actor.userName, email: event.actor.userName },
      workspace: { id: event.actor.workspaceId, name: event.actor.workspaceName },
      timestamp: new Date().toISOString(),
      changes: event.changes,
    };

    for (const webhook of matching) {
      const deliveryId = randomUUID();
      await this.queue.add(
        'deliver',
        { webhookId: webhook.id, deliveryId, eventType: event.eventType, payload, attemptNumber: 1 },
        { jobId: `${deliveryId}-1` },
      );
      this.logger.debug(`Queued webhook delivery ${deliveryId} for webhook ${webhook.id} (${event.eventType})`);
    }
  }

  /** tagSets: array of OR-groups; a fact sheet must match at least one tag id from EVERY group. */
  private async filterByTagSets<T extends { id: string; tagSets: unknown }>(webhooks: T[], factSheetId: string): Promise<T[]> {
    const withFilter = webhooks.filter((w) => Array.isArray(w.tagSets) && (w.tagSets as unknown[]).length > 0);
    if (withFilter.length === 0) return webhooks;

    const assignments = await this.prisma.tagAssignment.findMany({ where: { factSheetId } });
    const factSheetTagIds = new Set(assignments.map((a) => a.tagId));

    return webhooks.filter((w) => {
      const tagSets = w.tagSets as string[][] | null;
      if (!tagSets || tagSets.length === 0) return true;
      return tagSets.every((group) => group.some((tagId) => factSheetTagIds.has(tagId)));
    });
  }
}
