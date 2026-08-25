import { ApiProperty } from '@nestjs/swagger';
import { WEBHOOK_EVENTS } from '@leanix-mock/shared';

export class RegisterWebhookDto {
  @ApiProperty({ example: 'https://your-app.com/webhooks/leanix' })
  url!: string;

  @ApiProperty({ enum: WEBHOOK_EVENTS, isArray: true, example: ['FACT_SHEET_CREATED', 'FACT_SHEET_UPDATED'] })
  events!: string[];

  @ApiProperty({ required: false, example: 'your-webhook-secret', description: 'Used to compute the X-LeanIX-Signature HMAC-SHA256 header; auto-generated if omitted' })
  secret?: string;
}

export class WebhookResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ type: [String] })
  events!: string[];

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: string;
}
