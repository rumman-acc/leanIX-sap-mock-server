import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { IntegrationApiService } from '../services/integration-api.service';
import { IntegrationConfigurationInput, LdifUrlInput } from '@leanix-mock/shared';
import { CreateIntegrationConfigurationDto } from '../dto/integration-configuration.dto';
import {
  SyncRunCreatedResponseDto,
  SyncRunStatusResponseDto,
  SynchronizationRunInlineDto,
  SynchronizationRunUrlInputDto,
} from '../dto/sync-run.dto';

@ApiTags('Integration API')
@ApiBearerAuth()
@Controller('services/integration-api/v1')
@Roles('ADMIN', 'MEMBER')
export class IntegrationApiController {
  constructor(private readonly integrationApiService: IntegrationApiService) {}

  @Post('configurations')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create or update an integration configuration' })
  @ApiResponse({ status: 201, description: 'Configuration created/updated' })
  createConfiguration(@Body() body: CreateIntegrationConfigurationDto) {
    return this.integrationApiService.createConfiguration(body as IntegrationConfigurationInput);
  }

  @Get('configurations')
  @ApiOperation({ summary: 'List all integration configurations' })
  listConfigurations() {
    return this.integrationApiService.listConfigurations();
  }

  @Post('synchronizationRuns')
  @HttpCode(202)
  @ApiOperation({ summary: 'Run an LDIF sync inline — processed asynchronously, poll GET .../{id} for status' })
  @ApiResponse({ status: 202, description: 'Sync run created', type: SyncRunCreatedResponseDto })
  @ApiResponse({ status: 400, description: 'Malformed LDIF payload (INVALID_LDIF)' })
  createSyncRun(@Body() body: SynchronizationRunInlineDto) {
    return this.integrationApiService.createSyncRun(body);
  }

  @Post('synchronizationRuns/withUrlInput')
  @HttpCode(202)
  @ApiOperation({ summary: 'Run an LDIF sync by fetching content from a URL' })
  @ApiResponse({ status: 202, description: 'Sync run created', type: SyncRunCreatedResponseDto })
  createSyncRunFromUrl(@Body() body: SynchronizationRunUrlInputDto) {
    return this.integrationApiService.createSyncRunFromUrl(body as LdifUrlInput);
  }

  @Get('synchronizationRuns/:id')
  @ApiOperation({ summary: 'Get sync run status and counts' })
  @ApiParam({ name: 'id', example: 'sync-run-67890' })
  @ApiResponse({ status: 200, type: SyncRunStatusResponseDto })
  @ApiResponse({ status: 404, description: 'SYNC_RUN_NOT_FOUND' })
  getSyncRun(@Param('id') id: string) {
    return this.integrationApiService.getSyncRun(id);
  }

  @Get('synchronizationRuns/:id/logs')
  @ApiOperation({ summary: 'Get row-level sync logs for a run (not in spec — added for debuggability)' })
  @ApiParam({ name: 'id', example: 'sync-run-67890' })
  getSyncRunLogs(@Param('id') id: string) {
    return this.integrationApiService.getSyncRunLogs(id);
  }
}
