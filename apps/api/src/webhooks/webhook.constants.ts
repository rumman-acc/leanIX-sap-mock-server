import { WebhookPayload } from '@leanix-mock/shared';

export const WEBHOOK_DELIVERY_QUEUE = 'webhook-delivery';

export interface WebhookDeliveryJobData {
  webhookId: string;
  deliveryId: string;
  eventType: string;
  payload: WebhookPayload;
  attemptNumber: number;
}
