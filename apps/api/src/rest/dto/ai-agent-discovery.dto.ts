import { ApiProperty } from '@nestjs/swagger';

/**
 * Best-effort shape, not independently confirmed against a real workspace (no license to verify
 * against — see LeanIX_Mock_Server_Scope.md §12/§13 and docs/RESEARCH_LEANIX_REAL_API.md's
 * pattern for other undocumented endpoints). Real LeanIX's AI Agent Discovery API ingests an
 * A2A-protocol agent card; this accepts the fields the capability map documents it uses for
 * governance (name/description/ownership/risk) rather than the full A2A card schema.
 */
export class DiscoverAgentDto {
  @ApiProperty({ example: 'EA Copilot' })
  name!: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false, description: 'Stable id from the source agent registry' })
  externalId?: string;

  @ApiProperty({ required: false, enum: ['assistant', 'autonomous', 'workflow'] })
  agentType?: string;

  @ApiProperty({ required: false, enum: ['low', 'medium', 'high'] })
  riskClassification?: string;

  @ApiProperty({ required: false, example: 'Anthropic' })
  modelProvider?: string;
}

export class DiscoverAgentResponseDto {
  @ApiProperty({ example: 'OK' })
  status!: string;

  @ApiProperty()
  data!: unknown;
}
