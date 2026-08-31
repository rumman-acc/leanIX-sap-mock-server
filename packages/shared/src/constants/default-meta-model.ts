/**
 * Default (seed) meta model: fact sheet types, their attributes and relation types.
 *
 * Spec (section 11) only fully defines fields for `Application`. For the other 8 types it
 * only names them. Ambiguity resolution (see docs/BUILD_STATUS.md): every type gets the same
 * baseline attributes (name/description/externalId/lifecycle) so completion calculation and
 * GraphQL/REST behavior is uniform across types; Application additionally gets the
 * suitability/criticality fields the spec calls out explicitly.
 */

export type AttributeDataType =
  | 'STRING'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'URL'
  | 'SINGLE_SELECT'
  | 'MULTIPLE_SELECT';

export interface DefaultAllowedValue {
  value: string;
  label: string;
  color?: string;
}

export interface DefaultAttribute {
  technicalKey: string;
  label: string;
  description?: string;
  dataType: AttributeDataType;
  mandatory: boolean;
  hidden?: boolean;
  readOnly?: boolean;
  allowedValues?: DefaultAllowedValue[];
}

export interface DefaultFactSheetType {
  technicalKey: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  attributes: DefaultAttribute[];
}

export interface DefaultRelationType {
  technicalKey: string;
  label: string;
  description?: string;
  sourceType: string;
  targetType: string;
  cardinality: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
  mandatory: boolean;
}

const SUITABILITY_VALUES: DefaultAllowedValue[] = [
  { value: 'unknown', label: 'Unknown', color: '#CCCCCC' },
  { value: 'insufficient', label: 'Insufficient', color: '#E57373' },
  { value: 'sufficient', label: 'Sufficient', color: '#FFD54F' },
  { value: 'perfect', label: 'Perfect', color: '#81C784' },
];

// Sourced directly from a real LeanIX customer workspace's Integration API config example
// (github.com/leanix-public/integration-api-examples, "Update-BusinessCriticality" task README's
// external-value-to-LeanIX-value mapping table) — HIGH confidence, unlike the SUITABILITY_VALUES
// above which stay illustrative placeholders per docs/RESEARCH_LEANIX_REAL_API.md §5.
const BUSINESS_CRITICALITY_VALUES: DefaultAllowedValue[] = [
  { value: 'administrativeService', label: 'Administrative Service', color: '#CCCCCC' },
  { value: 'businessOperational', label: 'Business Operational', color: '#81C784' },
  { value: 'businessCritical', label: 'Business Critical', color: '#FFD54F' },
  { value: 'missionCritical', label: 'Mission Critical', color: '#E57373' },
];

// Illustrative placeholders, same status as SUITABILITY_VALUES above — real LeanIX has no
// dedicated "standards" API to source real enum values from (see docs/RESEARCH_LEANIX_REAL_API.md
// and LeanIX_Mock_Server_Scope.md §11: don't invent business logic the real system doesn't have).
// This models governance status through the existing generic attribute mechanism instead.
const STANDARD_STATUS_VALUES: DefaultAllowedValue[] = [
  { value: 'approved', label: 'Approved', color: '#81C784' },
  { value: 'emerging', label: 'Emerging', color: '#FFD54F' },
  { value: 'deprecated', label: 'Deprecated', color: '#E57373' },
  { value: 'prohibited', label: 'Prohibited', color: '#B71C1C' },
];

const AGENT_TYPE_VALUES: DefaultAllowedValue[] = [
  { value: 'assistant', label: 'Assistant', color: '#4FC3F7' },
  { value: 'autonomous', label: 'Autonomous Agent', color: '#7E57C2' },
  { value: 'workflow', label: 'Workflow Automation', color: '#4DB6AC' },
];

const RISK_CLASSIFICATION_VALUES: DefaultAllowedValue[] = [
  { value: 'low', label: 'Low', color: '#81C784' },
  { value: 'medium', label: 'Medium', color: '#FFD54F' },
  { value: 'high', label: 'High', color: '#E57373' },
];

const baseAttributes = (): DefaultAttribute[] => [
  { technicalKey: 'name', label: 'Name', dataType: 'STRING', mandatory: true },
  { technicalKey: 'description', label: 'Description', dataType: 'STRING', mandatory: false },
  { technicalKey: 'externalId', label: 'External ID', dataType: 'STRING', mandatory: false },
  { technicalKey: 'lifecycle', label: 'Lifecycle', dataType: 'SINGLE_SELECT', mandatory: false },
];

export const DEFAULT_FACT_SHEET_TYPES: DefaultFactSheetType[] = [
  {
    technicalKey: 'Application',
    label: 'Application',
    description: 'A software application supporting business processes',
    icon: 'application',
    color: '#6A1B9A',
    attributes: [
      ...baseAttributes(),
      {
        technicalKey: 'functionalSuitability',
        label: 'Functional Suitability',
        dataType: 'SINGLE_SELECT',
        mandatory: false,
        allowedValues: SUITABILITY_VALUES,
      },
      {
        technicalKey: 'technicalSuitability',
        label: 'Technical Suitability',
        dataType: 'SINGLE_SELECT',
        mandatory: false,
        allowedValues: SUITABILITY_VALUES,
      },
      {
        technicalKey: 'businessCriticality',
        label: 'Business Criticality',
        dataType: 'SINGLE_SELECT',
        mandatory: false,
        allowedValues: BUSINESS_CRITICALITY_VALUES,
      },
    ],
  },
  {
    technicalKey: 'BusinessCapability',
    label: 'Business Capability',
    description: 'What the business does, independent of how',
    icon: 'businessCapability',
    color: '#1565C0',
    attributes: baseAttributes(),
  },
  {
    technicalKey: 'ITComponent',
    label: 'IT Component',
    description: 'Technology building block (hardware, software, service)',
    icon: 'itComponent',
    color: '#2E7D32',
    attributes: baseAttributes(),
  },
  {
    technicalKey: 'Provider',
    label: 'Provider',
    description: 'External or internal provider of IT components/services',
    icon: 'provider',
    color: '#EF6C00',
    attributes: baseAttributes(),
  },
  {
    technicalKey: 'Process',
    label: 'Process',
    description: 'A business process',
    icon: 'process',
    color: '#00838F',
    attributes: baseAttributes(),
  },
  {
    technicalKey: 'Project',
    label: 'Project',
    description: 'A project changing the IT/business landscape',
    icon: 'project',
    color: '#AD1457',
    attributes: baseAttributes(),
  },
  {
    technicalKey: 'DataObject',
    label: 'Data Object',
    description: 'A business data object/entity',
    icon: 'dataObject',
    color: '#4527A0',
    attributes: baseAttributes(),
  },
  {
    technicalKey: 'Interface',
    label: 'Interface',
    description: 'An interface/integration between applications',
    icon: 'interface',
    color: '#5D4037',
    attributes: baseAttributes(),
  },
  {
    technicalKey: 'TechnicalStack',
    label: 'Technical Stack',
    description: 'A layer of the technical stack',
    icon: 'technicalStack',
    color: '#37474F',
    attributes: baseAttributes(),
  },
  {
    technicalKey: 'TechCategory',
    label: 'Tech Category',
    description: 'A category of technology and its governance/standards status — modeled through the existing generic attribute mechanism rather than a separate "standards" subsystem, since real LeanIX has no dedicated standards API.',
    icon: 'techCategory',
    color: '#8D6E63',
    attributes: [
      ...baseAttributes(),
      {
        technicalKey: 'standardStatus',
        label: 'Standard Status',
        dataType: 'SINGLE_SELECT',
        mandatory: false,
        allowedValues: STANDARD_STATUS_VALUES,
      },
    ],
  },
  {
    technicalKey: 'Objective',
    label: 'Objective',
    description: 'A strategic objective or OKR that initiatives and capabilities trace back to',
    icon: 'objective',
    color: '#C62828',
    attributes: baseAttributes(),
  },
  {
    technicalKey: 'AIAgent',
    label: 'AI Agent',
    description: 'An AI agent or model tracked for governance — mirrors the AI Agent Discovery (A2A) inventory real LeanIX exposes.',
    icon: 'aiAgent',
    color: '#00695C',
    attributes: [
      ...baseAttributes(),
      {
        technicalKey: 'agentType',
        label: 'Agent Type',
        dataType: 'SINGLE_SELECT',
        mandatory: false,
        allowedValues: AGENT_TYPE_VALUES,
      },
      {
        technicalKey: 'riskClassification',
        label: 'Risk Classification',
        dataType: 'SINGLE_SELECT',
        mandatory: false,
        allowedValues: RISK_CLASSIFICATION_VALUES,
      },
      {
        technicalKey: 'modelProvider',
        label: 'Model Provider',
        dataType: 'STRING',
        mandatory: false,
      },
    ],
  },
];

export const DEFAULT_RELATION_TYPES: DefaultRelationType[] = [
  {
    technicalKey: 'relApplicationToITComponent',
    label: 'Application to IT Component',
    sourceType: 'Application',
    targetType: 'ITComponent',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
  {
    technicalKey: 'relApplicationToBusinessCapability',
    label: 'Application to Business Capability',
    sourceType: 'Application',
    targetType: 'BusinessCapability',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
  {
    technicalKey: 'relApplicationToApplication',
    label: 'Application to Application',
    sourceType: 'Application',
    targetType: 'Application',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
  {
    technicalKey: 'relApplicationToProvider',
    label: 'Application to Provider',
    sourceType: 'Application',
    targetType: 'Provider',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
  {
    technicalKey: 'relITComponentToProvider',
    label: 'IT Component to Provider',
    sourceType: 'ITComponent',
    targetType: 'Provider',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
  {
    technicalKey: 'relApplicationToTechCategory',
    label: 'Application to Tech Category',
    sourceType: 'Application',
    targetType: 'TechCategory',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
  {
    technicalKey: 'relITComponentToTechCategory',
    label: 'IT Component to Tech Category',
    sourceType: 'ITComponent',
    targetType: 'TechCategory',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
  {
    technicalKey: 'relProjectToObjective',
    label: 'Project to Objective',
    sourceType: 'Project',
    targetType: 'Objective',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
  {
    technicalKey: 'relBusinessCapabilityToObjective',
    label: 'Business Capability to Objective',
    sourceType: 'BusinessCapability',
    targetType: 'Objective',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
  {
    technicalKey: 'relAIAgentToApplication',
    label: 'AI Agent to Application',
    sourceType: 'AIAgent',
    targetType: 'Application',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
  {
    technicalKey: 'relAIAgentToBusinessCapability',
    label: 'AI Agent to Business Capability',
    sourceType: 'AIAgent',
    targetType: 'BusinessCapability',
    cardinality: 'MANY_TO_MANY',
    mandatory: false,
  },
];
