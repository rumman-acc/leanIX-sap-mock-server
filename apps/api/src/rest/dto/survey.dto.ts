import { ApiProperty } from '@nestjs/swagger';

export class SurveyQuestionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({ required: false, default: 'TEXT', enum: ['TEXT', 'SINGLE_SELECT', 'BOOLEAN'] })
  type?: string;

  @ApiProperty({ required: false, type: [String] })
  options?: string[];
}

export class CreateSurveyDefinitionDto {
  @ApiProperty({ example: 'Application Owner Confirmation' })
  name!: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false, example: 'Application' })
  factSheetType?: string;

  @ApiProperty({ type: [SurveyQuestionDto] })
  questions!: SurveyQuestionDto[];
}

export class CreateSurveyRunDto {
  @ApiProperty()
  definitionId!: string;
}

export class CreateInvitationDto {
  @ApiProperty({ description: 'User id to invite' })
  userId!: string;

  @ApiProperty({ required: false, description: 'Fact sheet this invitation is about, e.g. the Application being surveyed' })
  factSheetId?: string;
}

export class SubmitResponseDto {
  @ApiProperty()
  invitationId!: string;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Map of question id -> answer' })
  answers!: Record<string, unknown>;
}
