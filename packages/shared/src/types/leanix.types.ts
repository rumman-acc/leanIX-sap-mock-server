import { WorkspaceRole } from '../constants/leanix.constants';

export interface JwtClaims {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  workspaceId: string;
  workspaceName: string;
  workspaceRole: WorkspaceRole;
  userName: string;
}

export interface FieldFilterInput {
  key: string;
  values: string[];
  operator?: 'EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'IN' | 'NOT_IN';
}

export interface RelationFilterInput {
  relationType: string;
  targetType?: string;
  targetId?: string;
}

/** Real LeanIX's facet-based filter primitive — see docs/RESEARCH_LEANIX_REAL_API.md §3. */
export interface FacetFilterInput {
  facetKey: string;
  operator?: 'OR' | 'AND';
  keys: string[];
}

export interface FilterInput {
  /** Real LeanIX form. Well-known facetKeys: "FactSheetTypes", "_TAGS_"; else a custom attribute technicalKey. */
  facetFilters?: FacetFilterInput[];
  // --- Mock-only convenience form (kept for backward compatibility; not in real LeanIX) ---
  factSheetType?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  fieldFilters?: FieldFilterInput[];
  relationFilters?: RelationFilterInput[];
}

export interface SortInput {
  mode?: 'BY_FIELD' | 'BY_NAME' | 'BY_UPDATED_AT';
  key?: string;
  direction?: 'ASC' | 'DESC';
}

export type PatchOperation = 'add' | 'replace' | 'remove';

export interface Patch {
  op: PatchOperation;
  path: string;
  value?: unknown;
}

export interface TagGroupInput {
  name: string;
}

export interface TagInput {
  name: string;
  group?: TagGroupInput;
}

export interface UserInput {
  id?: string;
  email?: string;
  name?: string;
}

export interface SubscriptionInput {
  user: UserInput;
  type: 'RESPONSIBLE' | 'ACCOUNTABLE' | 'OBSERVER';
  roles?: string[];
}

export interface BaseFactSheetInput {
  name: string;
  type: string;
  description?: string;
  externalId?: string;
  tags?: TagInput[];
  subscriptions?: SubscriptionInput[];
}

export interface LifecyclePhaseInput {
  phase: 'plan' | 'phaseIn' | 'active' | 'phaseOut' | 'endOfLife';
  startDate: string | null;
}

export interface LifecycleInput {
  asString?: string;
  phases: LifecyclePhaseInput[];
}

/**
 * Matches real LeanIX's webhook subscription request body exactly — see
 * docs/RESEARCH_LEANIX_REAL_API.md §2 (sourced from the real terraform-provider-leanix client).
 * `events`/`secret` are a mock-only convenience extension, not part of the real contract.
 */
export interface WebhookConfig {
  identifier: string;
  targetUrl: string;
  targetMethod?: string;
  authorizationHeader?: string;
  callback?: string;
  /** Array of OR-groups; a fact sheet must have at least one tag id from EVERY group (AND across groups). */
  tagSets?: string[][];
  workspaceConstraint?: string;
  payloadMode?: string;
  active?: boolean;
  ignoreError?: boolean;
  // --- mock-only convenience (not part of real LeanIX's contract) ---
  events?: string[];
  secret?: string;
}

export interface WebhookPayload {
  eventType: string;
  factSheet: {
    id: string;
    type: string;
    name: string;
    externalId: string | null;
  };
  relation?: {
    id: string;
    type: string;
    target: {
      id: string;
      type: string;
      name: string;
      externalId: string | null;
    };
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
  };
  timestamp: string;
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
}
