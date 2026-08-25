import { ApiProperty } from '@nestjs/swagger';

export class CreateIntegrationConfigurationDto {
  @ApiProperty({ example: 'SAP Connector' })
  name!: string;

  @ApiProperty({ example: 'sap-connector' })
  connectorType!: string;

  @ApiProperty({ example: 'sap-prod' })
  connectorId!: string;

  @ApiProperty({ example: '1.0.0' })
  connectorVersion!: string;

  @ApiProperty({ enum: ['inbound', 'outbound'], example: 'inbound' })
  processingDirection!: 'inbound' | 'outbound';

  @ApiProperty({ enum: ['partial', 'full'], example: 'partial' })
  processingMode!: 'partial' | 'full';

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description: 'inboundFactSheet processor definitions — see spec section 9.5',
    example: [
      {
        processorType: 'inboundFactSheet',
        processorName: 'Applications from SAP',
        run: 0,
        enabled: true,
        variables: [],
        identifier: {
          external: { id: { key: 'externalId', value: '${data.externalId}' }, type: { key: 'type', value: '${data.type}' } },
        },
        updates: [{ key: { expr: '${data.type}' }, values: [{ key: 'name', expr: '${data.name}' }] }],
        logLevel: 'INFO',
      },
    ],
  })
  processors!: unknown[];
}
