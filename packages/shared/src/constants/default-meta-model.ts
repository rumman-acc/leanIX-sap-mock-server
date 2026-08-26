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
];
