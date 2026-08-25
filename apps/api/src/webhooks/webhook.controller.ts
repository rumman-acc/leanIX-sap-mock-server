import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebhookConfig } from '@leanix-mock/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { WebhookService } from './webhook.service';
import { RegisterWebhookDto, WebhookResponseDto } from '../rest/dto/webhook.dto';

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('services/webhook/v1/webhooks')
@Roles('ADMIN', 'MEMBER')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a webhook' })
  @ApiResponse({ status: 201, type: WebhookResponseDto })
  register(@Body() body: RegisterWebhookDto) {
    return this.webhookService.register(body as WebhookConfig);
  }

  @Get()
  @ApiOperation({ summary: 'List all registered webhooks' })
  @ApiResponse({ status: 200, type: [WebhookResponseDto] })
  list() {
    return this.webhookService.list();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiParam({ name: 'id', example: 'wh-12345' })
  remove(@Param('id') id: string) {
    return this.webhookService.remove(id);
  }
}
