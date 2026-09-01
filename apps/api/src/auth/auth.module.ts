import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LeanIxConfig } from '../config/leanix.config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LeanIxAuthGuard } from './guards/leanix-auth.guard';
import { RolesGuard } from './guards/roles.guard';

const jwtModule = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const config = configService.get<LeanIxConfig>('leanix')!;
    return { secret: config.jwtSecret };
  },
});

@Module({
  imports: [jwtModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: LeanIxAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  // JwtModule re-exported so other modules (e.g. mcp-server, which resolves a caller's own
  // Authorization header rather than relying on the global LeanIxAuthGuard) can inject
  // JwtService without a second registerAsync().
  exports: [AuthService, jwtModule],
})
export class AuthModule {}
