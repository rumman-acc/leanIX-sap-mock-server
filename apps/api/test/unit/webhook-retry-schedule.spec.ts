import { webhookRetryDelayMs, WEBHOOK_MAX_ATTEMPTS } from '@leanix-mock/shared';

describe('webhookRetryDelayMs', () => {
  it('matches the spec retry schedule (section 10.4)', () => {
    expect(webhookRetryDelayMs(1)).toBe(0); // initial delivery, immediate
    expect(webhookRetryDelayMs(2)).toBe(5_000); // 5s
    expect(webhookRetryDelayMs(3)).toBe(25_000); // 25s
    expect(webhookRetryDelayMs(4)).toBe(120_000); // 2 min
    expect(webhookRetryDelayMs(5)).toBe(600_000); // 10 min
    expect(webhookRetryDelayMs(6)).toBe(3_600_000); // 1 hour
    expect(webhookRetryDelayMs(10)).toBe(3_600_000); // subsequent failures stay at 1 hour
  });

  it('caps at 10 max attempts', () => {
    expect(WEBHOOK_MAX_ATTEMPTS).toBe(10);
  });
});
