export const ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  FACT_SHEET_NOT_FOUND: 'FACT_SHEET_NOT_FOUND',
  FACT_SHEET_TYPE_NOT_FOUND: 'FACT_SHEET_TYPE_NOT_FOUND',
  INVALID_PATCH: 'INVALID_PATCH',
  DUPLICATE_EXTERNAL_ID: 'DUPLICATE_EXTERNAL_ID',
  RELATION_NOT_FOUND: 'RELATION_NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_LDIF: 'INVALID_LDIF',
  SYNC_RUN_NOT_FOUND: 'SYNC_RUN_NOT_FOUND',
  WEBHOOK_DELIVERY_FAILED: 'WEBHOOK_DELIVERY_FAILED',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  FACT_SHEET_NOT_FOUND: 404,
  FACT_SHEET_TYPE_NOT_FOUND: 404,
  INVALID_PATCH: 400,
  DUPLICATE_EXTERNAL_ID: 409,
  RELATION_NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  INVALID_LDIF: 400,
  SYNC_RUN_NOT_FOUND: 404,
  WEBHOOK_DELIVERY_FAILED: 502,
};

export const WORKSPACE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const FACT_SHEET_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const QUALITY_SEAL = {
  BROKEN: 'BROKEN',
  APPROVED: 'APPROVED',
} as const;

export const LIFECYCLE_PHASES = ['plan', 'phaseIn', 'active', 'phaseOut', 'endOfLife'] as const;

export const WEBHOOK_EVENTS = [
  'FACT_SHEET_CREATED',
  'FACT_SHEET_UPDATED',
  'FACT_SHEET_ARCHIVED',
  'RELATION_CREATED',
  'FACT_SHEET_FIELD_UPDATED',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Delay in ms before each retry attempt, indexed by attempt number (1-based, attempt 1 = first delivery). */
export const WEBHOOK_RETRY_SCHEDULE_MS = [0, 5_000, 25_000, 120_000, 600_000, 3_600_000] as const;
export const WEBHOOK_MAX_ATTEMPTS = 10;
export const WEBHOOK_TIMEOUT_MS = 50_000;

/** Delay before the given attempt number (1 = initial delivery = immediate, 2 = first retry, ...). */
export function webhookRetryDelayMs(attemptNumber: number): number {
  const idx = Math.max(0, Math.min(attemptNumber - 1, WEBHOOK_RETRY_SCHEDULE_MS.length - 1));
  return WEBHOOK_RETRY_SCHEDULE_MS[idx];
}

export const SYNC_RUN_STATUS = {
  CREATED: 'CREATED',
  RUNNING: 'RUNNING',
  FINISHED: 'FINISHED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export const SYNC_LOG_LEVEL = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
} as const;

export const DEFAULT_RATE_LIMIT_USER_PER_MINUTE = 1800;
export const DEFAULT_RATE_LIMIT_WORKSPACE_PER_MINUTE = 1200;
export const DEFAULT_TRASH_BIN_RETENTION_DAYS = 90;

export const SUBSCRIPTION_TYPES = ['RESPONSIBLE', 'ACCOUNTABLE', 'OBSERVER'] as const;
