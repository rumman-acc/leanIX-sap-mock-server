import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtClaims } from '@leanix-mock/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiAgentDiscoveryService } from './ai-agent-discovery.service';
import { DiscoverAgentDto, DiscoverAgentResponseDto } from '../rest/dto/ai-agent-discovery.dto';

// Path per LeanIX_Complete_Extensibility_Capability_Map.md §1.5 (A2A agent-card upload) — exact
// real path not independently confirmed, see the DTO's doc comment.
@ApiTags('AI Agent Discovery')
@ApiBearerAuth()
@Controller('services/aiagent/v1/discovery')
export class AiAgentDiscoveryController {
  constructor(private readonly discoveryService: AiAgentDiscoveryService) {}

  @Post()
  @HttpCode(201)
  @Roles('ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Register/upsert an AI agent card into the fact sheet repository as an AIAgent fact sheet' })
  @ApiResponse({ status: 201, type: DiscoverAgentResponseDto })
  discover(@Body() body: DiscoverAgentDto, @CurrentUser() user: JwtClaims) {
    return this.discoveryService.discover(body, user);
  }
}
