// Field resolvers shared by every concrete fact-sheet type (Application, ITComponent, ...).
//
// Real LeanIX exposes a `BaseFactSheet` GraphQL *interface* with concrete implementing types per
// fact sheet type technicalKey, queried via inline fragments (`... on Application { ... }`) — see
// docs/RESEARCH_LEANIX_REAL_API.md §7. NestJS's schema-first `@Resolver('TypeName')` classes only
// register field resolvers under that exact type name; there is no interface-level fan-out to
// implementing types. Rather than duplicate the same field-resolution logic across 9 near-identical
// `@Resolver` classes, these are plain functions merged into every concrete type's resolver map via
// the `resolvers` option already passed to `GraphQLModule.forRoot()` (apps/api/src/graphql/graphql.module.ts).
// None of them need dependency injection — they are pure functions of the resolved parent object.

type FactSheetLike = {
  type: { technicalKey: string };
  qualitySeal: string;
  lifecycle?: unknown;
  tags?: Array<{ tag: { id: string; name: string; color: string | null; group: unknown } }>;
  subscriptions?: Array<{ id: string; type: string; roles: string[]; userId: string; userName: string; userEmail: string }>;
  attributes?: Array<{ id: string; value: unknown; attribute: { technicalKey: string } }>;
  sourceRelations?: Array<{ id: string; description: string | null; relationType: unknown; target: unknown }>;
  targetRelations?: Array<{ id: string; description: string | null; relationType: unknown; source: unknown }>;
  comments?: Array<{ id: string; factSheetId: string; message: string; createdAt: Date; user: { id: string; name: string; email: string } }>;
};

export function resolveType(factSheet: FactSheetLike) {
  return factSheet.type.technicalKey;
}

// Interface implementing types must each declare their own runtime type — see
// docs/RESEARCH_LEANIX_REAL_API.md §7. `type.technicalKey` values in our meta model already match
// the concrete GraphQL type names 1:1 (Application, ITComponent, ...), so this doubles as __resolveType.
export function resolveTypename(factSheet: FactSheetLike) {
  return factSheet.type.technicalKey;
}

export function resolveLxState(factSheet: FactSheetLike) {
  // Real LeanIX's lxState naming only diverges from qualitySeal for BROKEN (-> BROKEN_QUALITY_SEAL);
  // APPROVED/DRAFT/REJECTED are spelled the same in both — see docs/RESEARCH_LEANIX_REAL_API.md §6.
  return factSheet.qualitySeal === 'BROKEN' ? 'BROKEN_QUALITY_SEAL' : factSheet.qualitySeal;
}

export function resolveLifecycle(factSheet: FactSheetLike) {
  const lifecycle = factSheet.lifecycle as { asString?: string; phases?: unknown[] } | null;
  if (!lifecycle) return null;
  return { asString: lifecycle.asString ?? null, phases: lifecycle.phases ?? [] };
}

export function resolveTags(factSheet: FactSheetLike) {
  return (factSheet.tags ?? []).map((assignment) => ({
    id: assignment.tag.id,
    name: assignment.tag.name,
    color: assignment.tag.color,
    group: assignment.tag.group,
  }));
}

export function resolveSubscriptions(factSheet: FactSheetLike) {
  return (factSheet.subscriptions ?? []).map((sub) => ({
    id: sub.id,
    type: sub.type,
    roles: sub.roles,
    user: { id: sub.userId, name: sub.userName, email: sub.userEmail },
  }));
}

export function resolveAttributes(factSheet: FactSheetLike) {
  return (factSheet.attributes ?? []).map((av) => ({
    id: av.id,
    value: av.value,
    attribute: av.attribute,
  }));
}

export function resolveRelations(factSheet: FactSheetLike) {
  const asSource = (factSheet.sourceRelations ?? []).map((relation) => ({
    id: relation.id,
    description: relation.description,
    relationType: relation.relationType,
    source: factSheet,
    target: relation.target,
  }));
  const asTarget = (factSheet.targetRelations ?? []).map((relation) => ({
    id: relation.id,
    description: relation.description,
    relationType: relation.relationType,
    source: relation.source,
    target: factSheet,
  }));
  return [...asSource, ...asTarget];
}

export function resolveComments(factSheet: FactSheetLike) {
  return (factSheet.comments ?? []).map((comment) => ({
    id: comment.id,
    factSheetId: comment.factSheetId,
    message: comment.message,
    author: comment.user,
    createdAt: comment.createdAt,
  }));
}

function attributeValue(factSheet: FactSheetLike, technicalKey: string) {
  return (factSheet.attributes ?? []).find((av) => av.attribute.technicalKey === technicalKey)?.value ?? null;
}

// Named per-type fields for Application, matching real LeanIX's inline-fragment shape
// (`... on Application { functionalSuitability }`) rather than only the generic `attributes` array
// — see docs/RESEARCH_LEANIX_REAL_API.md §7. Both forms stay supported ("support both" pattern).
const APPLICATION_ONLY_FIELDS = {
  functionalSuitability: (factSheet: FactSheetLike) => attributeValue(factSheet, 'functionalSuitability'),
  technicalSuitability: (factSheet: FactSheetLike) => attributeValue(factSheet, 'technicalSuitability'),
  businessCriticality: (factSheet: FactSheetLike) => attributeValue(factSheet, 'businessCriticality'),
};

const TECH_CATEGORY_ONLY_FIELDS = {
  standardStatus: (factSheet: FactSheetLike) => attributeValue(factSheet, 'standardStatus'),
};

const AI_AGENT_ONLY_FIELDS = {
  agentType: (factSheet: FactSheetLike) => attributeValue(factSheet, 'agentType'),
  riskClassification: (factSheet: FactSheetLike) => attributeValue(factSheet, 'riskClassification'),
  modelProvider: (factSheet: FactSheetLike) => attributeValue(factSheet, 'modelProvider'),
};

// Per-type field extensions beyond COMMON_FACT_SHEET_FIELDS, matching real LeanIX's
// inline-fragment shape for named (not just generic `attributes`) fields.
const TYPE_ONLY_FIELDS: Record<string, Record<string, (factSheet: FactSheetLike) => unknown>> = {
  Application: APPLICATION_ONLY_FIELDS,
  TechCategory: TECH_CATEGORY_ONLY_FIELDS,
  AIAgent: AI_AGENT_ONLY_FIELDS,
};

const COMMON_FACT_SHEET_FIELDS = {
  type: resolveType,
  lxState: resolveLxState,
  lifecycle: resolveLifecycle,
  tags: resolveTags,
  subscriptions: resolveSubscriptions,
  attributes: resolveAttributes,
  relations: resolveRelations,
  comments: resolveComments,
};

// Every concrete fact sheet type in the meta model (packages/shared/src/constants/default-meta-model.ts).
const CONCRETE_FACT_SHEET_TYPES = [
  'Application',
  'BusinessCapability',
  'ITComponent',
  'Provider',
  'Process',
  'Project',
  'DataObject',
  'Interface',
  'TechnicalStack',
  'TechCategory',
  'Objective',
  'AIAgent',
];

export const baseFactSheetResolvers = {
  BaseFactSheet: {
    __resolveType: (factSheet: FactSheetLike) => resolveTypename(factSheet),
  },
  ...Object.fromEntries(
    CONCRETE_FACT_SHEET_TYPES.map((typeName) => [
      typeName,
      TYPE_ONLY_FIELDS[typeName] ? { ...COMMON_FACT_SHEET_FIELDS, ...TYPE_ONLY_FIELDS[typeName] } : COMMON_FACT_SHEET_FIELDS,
    ]),
  ),
};
