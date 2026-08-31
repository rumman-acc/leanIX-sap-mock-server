import { Module } from '@nestjs/common';
import { IntegrationModule } from '../integration/integration.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { CommentsModule } from '../comments/comments.module';
import { TodosModule } from '../todos/todos.module';
import { AiAgentDiscoveryModule } from '../ai-agent-discovery/ai-agent-discovery.module';
import { SurveysModule } from '../surveys/surveys.module';
import { IntegrationApiController } from './controllers/integration-api.controller';
import { IntegrationApiService } from './services/integration-api.service';

@Module({
  imports: [IntegrationModule, WebhooksModule, CommentsModule, TodosModule, AiAgentDiscoveryModule, SurveysModule],
  controllers: [IntegrationApiController],
  providers: [IntegrationApiService],
})
export class RestModule {}
