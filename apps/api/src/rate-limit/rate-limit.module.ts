import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';
import { RateLimitInterceptor } from './rate-limit.interceptor';

@Module({
  providers: [
    RateLimitService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
  ],
  exports: [RateLimitService],
})
export class RateLimitModule {}
