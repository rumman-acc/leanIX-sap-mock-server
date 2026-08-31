import { randomBytes } from 'crypto';

function shortId(length = 10): string {
  return randomBytes(length).toString('hex').slice(0, length);
}

export function generateId(prefix: string): string {
  return `${prefix}-${shortId()}`;
}

export const IdPrefix = {
  FACT_SHEET: 'fs',
  CONFIGURATION: 'cfg',
  SYNC_RUN: 'sync-run',
  SYNC_LOG: 'sync-log',
  WEBHOOK: 'wh',
  WEBHOOK_DELIVERY: 'delivery',
  RELATION: 'rel',
  TAG: 'tag',
  TAG_GROUP: 'taggroup',
  SUBSCRIPTION: 'sub',
  COMMENT: 'comment',
  TODO: 'todo',
  SURVEY_DEFINITION: 'survey-def',
  SURVEY_RUN: 'survey-run',
  SURVEY_INVITATION: 'survey-inv',
  SURVEY_RESPONSE: 'survey-resp',
} as const;
