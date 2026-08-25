import { Module } from '@nestjs/common';
import { IntegrationModule } from '../integration/integration.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { IntegrationApiController } from './controllers/integration-api.controller';
import { IntegrationApiService } from './services/integration-api.service';

@Module({
  imports: [IntegrationModule, WebhooksModule],
  controllers: [IntegrationApiController],
  providers: [IntegrationApiService],
})
export class RestModule {}
