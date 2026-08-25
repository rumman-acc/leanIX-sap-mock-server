export interface LdifContentItem {
  type: string;
  id: string;
  data: Record<string, unknown>;
}

export interface LDIF {
  connectorType: string;
  connectorId: string;
  connectorVersion: string;
  lxVersion: string;
  processingDirection: 'inbound' | 'outbound';
  processingMode: 'partial' | 'full';
  description?: string;
  content: LdifContentItem[];
}

export interface LdifUrlInput {
  connectorType: string;
  connectorId: string;
  connectorVersion: string;
  lxVersion: string;
  processingDirection: 'inbound' | 'outbound';
  processingMode: 'partial' | 'full';
  description?: string;
  url: string;
}

export interface ProcessorIdentifierField {
  key: string;
  value: string;
}

export interface ProcessorIdentifier {
  external: {
    id: ProcessorIdentifierField;
    type: ProcessorIdentifierField;
  };
}

export interface ProcessorUpdateValue {
  key: string;
  expr: string;
}

export interface ProcessorUpdate {
  key: { expr: string };
  values: ProcessorUpdateValue[];
}

export interface InboundFactSheetProcessor {
  processorType: 'inboundFactSheet';
  processorName: string;
  processorDescription?: string;
  run: number;
  enabled: boolean;
  variables: unknown[];
  identifier: ProcessorIdentifier;
  updates: ProcessorUpdate[];
  logLevel: 'INFO' | 'WARNING' | 'ERROR';
}

export interface IntegrationConfigurationInput {
  name: string;
  connectorType: string;
  connectorId: string;
  connectorVersion: string;
  processingDirection: 'inbound' | 'outbound';
  processingMode: 'partial' | 'full';
  processors: InboundFactSheetProcessor[];
}
