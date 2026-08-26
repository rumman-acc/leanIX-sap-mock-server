import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import axios, { Method } from 'axios';
import { createHmac } from 'crypto';
import { WEBHOOK_MAX_ATTEMPTS, WEBHOOK_TIMEOUT_MS, webhookRetryDelayMs } from '@leanix-mock/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WEBHOOK_DELIVERY_QUEUE, WebhookDeliveryJobData } from '../webhook.constants';

@Processor(WEBHOOK_DELIVERY_QUEUE)
export class HttpDispatcher extends WorkerHost {
  private readonly logger = new Logger(HttpDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE) private readonly queue: Queue<WebhookDeliveryJobData>,
  ) {
    super();
  }

  async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const { webhookId, deliveryId, eventType, payload, attemptNumber } = job.data;

    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook || !webhook.active) {
      this.logger.warn(`Skipping delivery ${deliveryId}: webhook ${webhookId} not found or inactive`);
      return;
    }

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Mock-only bonus headers (not part of real LeanIX's delivery contract, but harmless for
      // a consumer to ignore) — kept so existing integrations built against them keep working.
      'X-LeanIX-Event': eventType,
      'X-LeanIX-Delivery': deliveryId,
    };

    // Real LeanIX authenticates deliveries by sending this header verbatim — no payload
    // signing. See docs/RESEARCH_LEANIX_REAL_API.md §2.
    if (webhook.authorizationHeader) {
      headers.Authorization = webhook.authorizationHeader;
    }
    // Mock-only convenience: HMAC-SHA256 signature, only computed if a secret was configured.
    if (webhook.secret) {
      headers['X-LeanIX-Signature'] = `sha256=${createHmac('sha256', webhook.secret).update(body).digest('hex')}`;
    }

    try {
      const response = await axios.request({
        url: webhook.targetUrl,
        method: (webhook.targetMethod || 'POST') as Method,
        data: payload,
        timeout: WEBHOOK_TIMEOUT_MS,
        headers,
        validateStatus: () => true,
      });

      const success = response.status >= 200 && response.status < 300;
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId,
          eventType,
          payload: payload as any,
          responseStatus: response.status,
          responseBody: typeof response.data === 'string' ? response.data.slice(0, 2000) : JSON.stringify(response.data).slice(0, 2000),
          success,
          attemptCount: attemptNumber,
          completedAt: success ? new Date() : null,
        },
      });

      if (!success) {
        await this.scheduleRetry(job.data, attemptNumber, webhook.ignoreError, `HTTP ${response.status}`);
      }
    } catch (err) {
      const message = (err as Error).message;
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId,
          eventType,
          payload: payload as any,
          success: false,
          errorMessage: message,
          attemptCount: attemptNumber,
        },
      });
      await this.scheduleRetry(job.data, attemptNumber, webhook.ignoreError, message);
    }
  }

  private async scheduleRetry(data: WebhookDeliveryJobData, attemptNumber: number, ignoreError: boolean, reason: string): Promise<void> {
    // `ignoreError` (default true) matches real LeanIX's field name — interpreted here as "the
    // subscription doesn't care about delivery failures", so no retry. Set it to false to opt
    // into this mock's retry schedule for testing failure-handling behavior; this specific
    // retry-vs-ignore mapping is NOT independently confirmed against real LeanIX (see
    // docs/RESEARCH_LEANIX_REAL_API.md), it's the most defensible reading of the field name.
    if (ignoreError) {
      this.logger.debug(`Delivery ${data.deliveryId} failed (${reason}) — ignoreError=true, not retrying`);
      return;
    }

    if (attemptNumber >= WEBHOOK_MAX_ATTEMPTS) {
      this.logger.warn(`Delivery ${data.deliveryId} gave up after ${attemptNumber} attempts: ${reason}`);
      return;
    }

    const nextAttempt = attemptNumber + 1;
    const delay = webhookRetryDelayMs(nextAttempt);
    await this.queue.add(
      'deliver',
      { ...data, attemptNumber: nextAttempt },
      { jobId: `${data.deliveryId}-${nextAttempt}`, delay },
    );
    this.logger.log(`Scheduled retry ${nextAttempt}/${WEBHOOK_MAX_ATTEMPTS} for delivery ${data.deliveryId} in ${delay}ms (${reason})`);
  }
}
