import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { HttpCode } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { IntegrationApiService } from '../services/integration-api.service';
import { IntegrationConfigurationInput, LdifUrlInput } from '@leanix-mock/shared';

@Controller('services/integration-api/v1')
@Roles('ADMIN', 'MEMBER')
export class IntegrationApiController {
  constructor(private readonly integrationApiService: IntegrationApiService) {}

  @Post('configurations')
  @HttpCode(201)
  createConfiguration(@Body() body: IntegrationConfigurationInput) {
    return this.integrationApiService.createConfiguration(body);
  }

  @Get('configurations')
  listConfigurations() {
    return this.integrationApiService.listConfigurations();
  }

  @Post('synchronizationRuns')
  @HttpCode(202)
  createSyncRun(@Body() body: unknown) {
    return this.integrationApiService.createSyncRun(body);
  }

  @Post('synchronizationRuns/withUrlInput')
  @HttpCode(202)
  createSyncRunFromUrl(@Body() body: LdifUrlInput) {
    return this.integrationApiService.createSyncRunFromUrl(body);
  }

  @Get('synchronizationRuns/:id')
  getSyncRun(@Param('id') id: string) {
    return this.integrationApiService.getSyncRun(id);
  }

  @Get('synchronizationRuns/:id/logs')
  getSyncRunLogs(@Param('id') id: string) {
    return this.integrationApiService.getSyncRunLogs(id);
  }
}
