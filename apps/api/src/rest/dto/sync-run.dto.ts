import { ApiProperty } from '@nestjs/swagger';

export class LdifContentItemDto {
  @ApiProperty({ example: 'Application' })
  type!: string;

  @ApiProperty({ example: 'SRC-001', description: 'Source system record id' })
  id!: string;

  @ApiProperty({ type: 'object', example: { name: 'SAP ERP', externalId: 'SAP-001', description: 'Enterprise resource planning' } })
  data!: Record<string, unknown>;
}

export class SynchronizationRunInlineDto {
  @ApiProperty({ example: 'sap-connector' })
  connectorType!: string;

  @ApiProperty({ example: 'sap-prod' })
  connectorId!: string;

  @ApiProperty({ example: '1.0.0' })
  connectorVersion!: string;

  @ApiProperty({ example: '1.0.0' })
  lxVersion!: string;

  @ApiProperty({ enum: ['inbound', 'outbound'], example: 'inbound' })
  processingDirection!: 'inbound' | 'outbound';

  @ApiProperty({ enum: ['partial', 'full'], example: 'partial' })
  processingMode!: 'partial' | 'full';

  @ApiProperty({ required: false, example: 'Daily sync from SAP' })
  description?: string;

  @ApiProperty({ type: [LdifContentItemDto] })
  content!: LdifContentItemDto[];
}

export class SynchronizationRunUrlInputDto {
  @ApiProperty({ example: 'sap-connector' })
  connectorType!: string;

  @ApiProperty({ example: 'sap-prod' })
  connectorId!: string;

  @ApiProperty({ example: '1.0.0' })
  connectorVersion!: string;

  @ApiProperty({ example: '1.0.0' })
  lxVersion!: string;

  @ApiProperty({ enum: ['inbound', 'outbound'], example: 'inbound' })
  processingDirection!: 'inbound' | 'outbound';

  @ApiProperty({ enum: ['partial', 'full'], example: 'partial' })
  processingMode!: 'partial' | 'full';

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ example: 'https://your-server.com/ldif.json', description: 'URL returning either a JSON array of content items, or an object with a `content` field' })
  url!: string;
}

export class SyncRunCreatedResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['CREATED'] })
  status!: string;

  @ApiProperty()
  createdAt!: string;
}

export class SyncRunStatusResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['CREATED', 'RUNNING', 'FINISHED', 'FAILED', 'CANCELLED'] })
  status!: string;

  @ApiProperty({ required: false, nullable: true })
  startedAt?: string | null;

  @ApiProperty({ required: false, nullable: true })
  finishedAt?: string | null;

  @ApiProperty()
  errorCount!: number;

  @ApiProperty()
  warningCount!: number;

  @ApiProperty()
  processedCount!: number;

  @ApiProperty()
  createdCount!: number;

  @ApiProperty()
  updatedCount!: number;

  @ApiProperty()
  deletedCount!: number;
}
