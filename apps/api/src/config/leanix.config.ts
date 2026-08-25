import { registerAs } from '@nestjs/config';

export interface LeanIxConfig {
  mode: 'mock' | 'real';
  baseUrl: string;
  subdomain: string;
  apiToken: string;
  apiTokenSecret: string;
  workspace: string;
  jwtSecret: string;
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  rateLimitEnabled: boolean;
  webhookDeliveryEnabled: boolean;
  autoDeleteEnabled: boolean;
  trashBinRetentionDays: number;
  rateLimitUserPerMinute: number;
  rateLimitWorkspacePerMinute: number;
}

export default registerAs(
  'leanix',
  (): LeanIxConfig => ({
    mode: (process.env.LEANIX_MODE as 'mock' | 'real') || 'mock',
    baseUrl: process.env.LEANIX_BASE_URL || 'http://localhost:4000',
    subdomain: process.env.LEANIX_SUBDOMAIN || 'mock',
    apiToken: process.env.LEANIX_API_TOKEN || 'dev-token-12345',
    apiTokenSecret: process.env.LEANIX_API_TOKEN_SECRET || 'dev-secret-67890',
    workspace: process.env.LEANIX_WORKSPACE || 'development',
    jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-prod',
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || '',
    rateLimitEnabled: process.env.MOCK_RATE_LIMIT_ENABLED !== 'false',
    webhookDeliveryEnabled: process.env.MOCK_WEBHOOK_DELIVERY_ENABLED !== 'false',
    autoDeleteEnabled: process.env.MOCK_AUTO_DELETE_ENABLED !== 'false',
    trashBinRetentionDays: parseInt(process.env.MOCK_TRASH_BIN_RETENTION_DAYS || '90', 10),
    rateLimitUserPerMinute: parseInt(process.env.RATE_LIMIT_USER_PER_MINUTE || '1800', 10),
    rateLimitWorkspacePerMinute: parseInt(process.env.RATE_LIMIT_WORKSPACE_PER_MINUTE || '1200', 10),
  }),
);
