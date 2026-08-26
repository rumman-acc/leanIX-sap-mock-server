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
    description:
      'inboundFactSheet processor definitions. Stored as-is and NOT interpreted/evaluated by this mock — ' +
      'actual sync-run field mapping is a simpler 1:1 data-key-to-field-name pass (see docs/RESEARCH_LEANIX_REAL_API.md §5). ' +
      'The example below is real LeanIX\'s actual config shape (sourced from github.com/leanix-public/integration-api-examples), ' +
      'not the (inaccurate) one in the original spec doc.',
    example: [
      {
        processorType: 'inboundFactSheet',
        processorName: 'Create Application',
        processorDescription: 'Creates LeanIX Applications',
        type: 'Application',
        filter: { type: 'Application' },
        identifier: { external: { id: { expr: '${content.id}' }, type: { expr: 'externalId' } } },
        run: 0,
        updates: [{ key: { expr: 'name' }, values: [{ expr: '${data.name}' }] }],
        enabled: true,
        variables: [],
        logLevel: 'warning',
      },
    ],
  })
  processors!: unknown[];
}
