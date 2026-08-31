import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtClaims, WebhookConfig } from '@leanix-mock/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WebhookService } from './webhook.service';
import { RegisterWebhookDto, WebhookSubscriptionResponseDto, WebhookSubscriptionListResponseDto } from '../rest/dto/webhook.dto';

// Path matches real LeanIX exactly: POST/GET /services/webhooks/v1/subscriptions,
// GET/PUT/DELETE /services/webhooks/v1/subscriptions/{id} — see docs/RESEARCH_LEANIX_REAL_API.md §2.
@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('services/webhooks/v1/subscriptions')
@Roles('ADMIN', 'MEMBER')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a webhook subscription' })
  @ApiResponse({ status: 201, type: WebhookSubscriptionResponseDto })
  register(@Body() body: RegisterWebhookDto, @CurrentUser() user: JwtClaims) {
    return this.webhookService.register(body as WebhookConfig, user.workspaceId);
  }

  @Get()
  @ApiOperation({ summary: 'List all webhook subscriptions' })
  @ApiResponse({ status: 200, type: WebhookSubscriptionListResponseDto })
  list(@CurrentUser() user: JwtClaims) {
    return this.webhookService.list(user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook subscription' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: WebhookSubscriptionResponseDto })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtClaims) {
    return this.webhookService.findOne(id, user.workspaceId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a webhook subscription' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: WebhookSubscriptionResponseDto })
  update(@Param('id') id: string, @Body() body: Partial<RegisterWebhookDto>, @CurrentUser() user: JwtClaims) {
    return this.webhookService.update(id, body as Partial<WebhookConfig>, user.workspaceId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook subscription' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: WebhookSubscriptionResponseDto })
  remove(@Param('id') id: string, @CurrentUser() user: JwtClaims) {
    return this.webhookService.remove(id, user.workspaceId);
  }
}
