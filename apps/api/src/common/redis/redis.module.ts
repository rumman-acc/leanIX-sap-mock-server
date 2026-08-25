import { Global, Module, OnModuleDestroy, Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LeanIxConfig } from '../../config/leanix.config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<LeanIxConfig>('leanix')!;
        return new Redis(config.redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: false,
        });
      },
    },
    RedisLifecycle,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
