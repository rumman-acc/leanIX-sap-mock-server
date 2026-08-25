import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../common/redis/redis.module';

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds when the window fully resets (oldest request falls out of the window). */
  resetAt: number;
  retryAfterSeconds: number;
}

const WINDOW_MS = 60_000;

@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Sliding-window rate limit using a Redis sorted set: each request is a member scored by
   * its timestamp; members older than the window are trimmed before counting.
   */
  async checkAndIncrement(key: string, limit: number): Promise<RateLimitCheckResult> {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const redisKey = `ratelimit:${key}`;
    const member = `${now}:${randomUUID()}`;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zadd(redisKey, now, member);
    pipeline.zcard(redisKey);
    pipeline.pexpire(redisKey, WINDOW_MS);
    pipeline.zrange(redisKey, 0, 0, 'WITHSCORES');

    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) ?? 0;
    const oldestEntry = results?.[4]?.[1] as string[] | undefined;
    const oldestScore = oldestEntry && oldestEntry.length > 1 ? Number(oldestEntry[1]) : now;

    const resetAt = Math.ceil((oldestScore + WINDOW_MS) / 1000);
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const retryAfterSeconds = allowed ? 0 : Math.max(1, resetAt - Math.ceil(now / 1000));

    return { allowed, limit, remaining, resetAt, retryAfterSeconds };
  }
}
