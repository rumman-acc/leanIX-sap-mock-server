import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebhookConfig } from '@leanix-mock/shared';
import { Roles } from '../common/decorators/roles.decorator';
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
  register(@Body() body: RegisterWebhookDto) {
    return this.webhookService.register(body as WebhookConfig);
  }

  @Get()
  @ApiOperation({ summary: 'List all webhook subscriptions' })
  @ApiResponse({ status: 200, type: WebhookSubscriptionListResponseDto })
  list() {
    return this.webhookService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook subscription' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: WebhookSubscriptionResponseDto })
  findOne(@Param('id') id: string) {
    return this.webhookService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a webhook subscription' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: WebhookSubscriptionResponseDto })
  update(@Param('id') id: string, @Body() body: Partial<RegisterWebhookDto>) {
    return this.webhookService.update(id, body as Partial<WebhookConfig>);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook subscription' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: WebhookSubscriptionResponseDto })
  remove(@Param('id') id: string) {
    return this.webhookService.remove(id);
  }
}
