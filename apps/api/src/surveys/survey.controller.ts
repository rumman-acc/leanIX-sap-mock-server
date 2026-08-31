import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { SurveyService } from './survey.service';
import { CreateSurveyDefinitionDto, CreateSurveyRunDto, CreateInvitationDto, SubmitResponseDto } from '../rest/dto/survey.dto';

// Path per capability map §1.2 / LeanIX_Mock_Server_Scope.md §3: /services/survey/v1.
@ApiTags('Surveys')
@ApiBearerAuth()
@Controller('services/survey/v1')
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  @Post('definitions')
  @HttpCode(201)
  @Roles('ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Create a survey definition' })
  createDefinition(@Body() body: CreateSurveyDefinitionDto) {
    return this.surveyService.createDefinition(body);
  }

  @Get('definitions')
  @ApiOperation({ summary: 'List survey definitions' })
  listDefinitions() {
    return this.surveyService.listDefinitions();
  }

  @Get('definitions/:id')
  @ApiOperation({ summary: 'Get a survey definition' })
  @ApiParam({ name: 'id' })
  getDefinition(@Param('id') id: string) {
    return this.surveyService.getDefinition(id);
  }

  @Post('runs')
  @HttpCode(201)
  @Roles('ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Start a survey run from a definition' })
  createRun(@Body() body: CreateSurveyRunDto) {
    return this.surveyService.createRun(body);
  }

  @Get('runs')
  @ApiOperation({ summary: 'List survey runs' })
  listRuns() {
    return this.surveyService.listRuns();
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Get a survey run' })
  @ApiParam({ name: 'id' })
  getRun(@Param('id') id: string) {
    return this.surveyService.getRun(id);
  }

  @Post('runs/:id/invitations')
  @HttpCode(201)
  @Roles('ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Invite a respondent to a survey run' })
  @ApiParam({ name: 'id' })
  invite(@Param('id') id: string, @Body() body: CreateInvitationDto) {
    return this.surveyService.invite(id, body);
  }

  @Get('runs/:id/invitations')
  @ApiOperation({ summary: 'List invitations for a survey run' })
  @ApiParam({ name: 'id' })
  listInvitations(@Param('id') id: string) {
    return this.surveyService.listInvitations(id);
  }

  @Post('runs/:id/responses')
  @HttpCode(201)
  @ApiOperation({ summary: 'Submit a response to an invitation on this run' })
  @ApiParam({ name: 'id' })
  submitResponse(@Param('id') id: string, @Body() body: SubmitResponseDto) {
    return this.surveyService.submitResponse(id, body);
  }

  @Get('runs/:id/results')
  @ApiOperation({ summary: 'Aggregate results for a survey run' })
  @ApiParam({ name: 'id' })
  getResults(@Param('id') id: string) {
    return this.surveyService.getResults(id);
  }
}
