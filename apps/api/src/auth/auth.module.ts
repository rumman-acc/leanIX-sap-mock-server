import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LeanIxConfig } from '../config/leanix.config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LeanIxAuthGuard } from './guards/leanix-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<LeanIxConfig>('leanix')!;
        return { secret: config.jwtSecret };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: LeanIxAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
