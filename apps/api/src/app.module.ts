import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { APP_FILTER } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import leanixConfig, { LeanIxConfig } from './config/leanix.config';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { AuthModule } from './auth/auth.module';
import { MetaModelModule } from './meta-model/meta-model.module';
import { GraphqlModule } from './graphql/graphql.module';
import { TrashBinModule } from './trash-bin/trash-bin.module';
import { RestModule } from './rest/rest.module';
import { McpServerModule } from './mcp-server/mcp-server.module';
import { HealthController } from './common/health/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [leanixConfig],
      envFilePath: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<LeanIxConfig>('leanix')!;
        return { connection: new Redis(config.redisUrl, { maxRetriesPerRequest: null }) };
      },
    }),
    RateLimitModule,
    AuthModule,
    MetaModelModule,
    GraphqlModule,
    TrashBinModule,
    RestModule,
    McpServerModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
