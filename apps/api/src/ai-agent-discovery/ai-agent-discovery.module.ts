import { Module } from '@nestjs/common';
import { GraphqlModule } from '../graphql/graphql.module';
import { AiAgentDiscoveryService } from './ai-agent-discovery.service';
import { AiAgentDiscoveryController } from './ai-agent-discovery.controller';

@Module({
  imports: [GraphqlModule],
  controllers: [AiAgentDiscoveryController],
  providers: [AiAgentDiscoveryService],
})
export class AiAgentDiscoveryModule {}
