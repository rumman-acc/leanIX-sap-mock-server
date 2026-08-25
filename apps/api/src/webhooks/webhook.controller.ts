import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { WebhookConfig } from '@leanix-mock/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { WebhookService } from './webhook.service';

@Controller('services/webhook/v1/webhooks')
@Roles('ADMIN', 'MEMBER')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(201)
  register(@Body() body: WebhookConfig) {
    return this.webhookService.register(body);
  }

  @Get()
  list() {
    return this.webhookService.list();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.webhookService.remove(id);
  }
}
