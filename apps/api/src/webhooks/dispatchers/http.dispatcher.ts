import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import axios from 'axios';
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
    const signature = `sha256=${createHmac('sha256', webhook.secret ?? '').update(body).digest('hex')}`;

    try {
      const response = await axios.post(webhook.url, payload, {
        timeout: WEBHOOK_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'X-LeanIX-Event': eventType,
          'X-LeanIX-Delivery': deliveryId,
          'X-LeanIX-Signature': signature,
        },
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
        await this.scheduleRetry(job.data, attemptNumber, `HTTP ${response.status}`);
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
      await this.scheduleRetry(job.data, attemptNumber, message);
    }
  }

  private async scheduleRetry(data: WebhookDeliveryJobData, attemptNumber: number, reason: string): Promise<void> {
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
