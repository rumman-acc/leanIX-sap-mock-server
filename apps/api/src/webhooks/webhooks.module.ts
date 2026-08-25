import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { HttpDispatcher } from './dispatchers/http.dispatcher';
import { WEBHOOK_DELIVERY_QUEUE } from './webhook.constants';

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_DELIVERY_QUEUE })],
  controllers: [WebhookController],
  providers: [WebhookService, HttpDispatcher],
  exports: [WebhookService],
})
export class WebhooksModule {}
