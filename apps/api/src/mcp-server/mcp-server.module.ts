import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { McpServerController } from './mcp-server.controller';
import { McpServerAuthService } from './mcp-server-auth.service';

@Module({
  imports: [AuthModule],
  controllers: [McpServerController],
  providers: [McpServerAuthService],
})
export class McpServerModule {}
