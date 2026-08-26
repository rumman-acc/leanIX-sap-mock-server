import { ApiProperty } from '@nestjs/swagger';
import { WEBHOOK_EVENTS } from '@leanix-mock/shared';

/**
 * Fields identifier..ignoreError match real LeanIX's webhook subscription contract exactly
 * (see docs/RESEARCH_LEANIX_REAL_API.md §2). events/secret are a mock-only convenience
 * extension real LeanIX does not support (it ties triggers to a separately configured
 * Automation, and authenticates deliveries via authorizationHeader, not payload signing).
 */
export class RegisterWebhookDto {
  @ApiProperty({ example: 'My integration webhook', description: 'Human-readable label for this subscription' })
  identifier!: string;

  @ApiProperty({ example: 'https://your-app.com/webhooks/leanix' })
  targetUrl!: string;

  @ApiProperty({ required: false, example: 'POST', default: 'POST' })
  targetMethod?: string;

  @ApiProperty({ required: false, example: 'Bearer your-static-token', description: 'Sent verbatim as the Authorization header on every delivery' })
  authorizationHeader?: string;

  @ApiProperty({ required: false })
  callback?: string;

  @ApiProperty({
    required: false,
    type: 'array',
    items: { type: 'array', items: { type: 'string' } },
    description: 'Array of OR-groups of tag ids; a fact sheet must match at least one tag id from every group (AND across groups) for delivery to fire',
  })
  tagSets?: string[][];

  @ApiProperty({ required: false, default: 'ANY', example: 'ANY' })
  workspaceConstraint?: string;

  @ApiProperty({ required: false, default: 'DEFAULT', example: 'DEFAULT' })
  payloadMode?: string;

  @ApiProperty({ required: false, default: true })
  active?: boolean;

  @ApiProperty({ required: false, default: true })
  ignoreError?: boolean;

  @ApiProperty({
    required: false,
    enum: WEBHOOK_EVENTS,
    isArray: true,
    description: 'MOCK-ONLY EXTENSION (not in real LeanIX): restrict delivery to these event types. Omit to fire on every fact-sheet event, the closest analog to a real Automation with no narrowing trigger.',
  })
  events?: string[];

  @ApiProperty({
    required: false,
    description: 'MOCK-ONLY EXTENSION (not in real LeanIX): if set, deliveries are also HMAC-SHA256 signed via X-LeanIX-Signature, in addition to any authorizationHeader.',
  })
  secret?: string;
}

export class WebhookSubscriptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  identifier!: string;

  @ApiProperty()
  targetUrl!: string;

  @ApiProperty()
  targetMethod!: string;

  @ApiProperty({ enum: ['PUSH'] })
  deliveryType!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  workspaceConstraint!: string;

  @ApiProperty()
  payloadMode!: string;

  @ApiProperty()
  createdAt!: string;
}

export class WebhookSubscriptionResponseDto {
  @ApiProperty({ example: 'OK' })
  status!: string;

  @ApiProperty({ type: WebhookSubscriptionDto })
  data!: WebhookSubscriptionDto;
}

export class WebhookSubscriptionListResponseDto {
  @ApiProperty({ example: 'OK' })
  status!: string;

  @ApiProperty({ type: [WebhookSubscriptionDto] })
  data!: WebhookSubscriptionDto[];
}
