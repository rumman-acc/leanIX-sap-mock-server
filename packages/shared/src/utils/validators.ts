import { LDIF, LdifContentItem } from '../types/ldif.types';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const REQUIRED_LDIF_HEADER_FIELDS = [
  'connectorType',
  'connectorId',
  'connectorVersion',
  'lxVersion',
  'processingDirection',
  'processingMode',
  'content',
] as const;

export function validateLdifStructure(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: [{ path: '', message: 'LDIF payload must be a JSON object' }] };
  }

  const ldif = input as Record<string, unknown>;

  for (const field of REQUIRED_LDIF_HEADER_FIELDS) {
    if (ldif[field] === undefined || ldif[field] === null || ldif[field] === '') {
      errors.push({ path: field, message: `${field} is required` });
    }
  }

  if (
    ldif.processingDirection !== undefined &&
    ldif.processingDirection !== 'inbound' &&
    ldif.processingDirection !== 'outbound'
  ) {
    errors.push({ path: 'processingDirection', message: 'processingDirection must be "inbound" or "outbound"' });
  }

  if (
    ldif.processingMode !== undefined &&
    ldif.processingMode !== 'partial' &&
    ldif.processingMode !== 'full'
  ) {
    errors.push({ path: 'processingMode', message: 'processingMode must be "partial" or "full"' });
  }

  if (ldif.content !== undefined) {
    if (!Array.isArray(ldif.content)) {
      errors.push({ path: 'content', message: 'content must be an array' });
    } else {
      ldif.content.forEach((item, index) => {
        errors.push(...validateLdifContentItem(item, index));
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateLdifContentItem(item: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `content[${index}]`;

  if (typeof item !== 'object' || item === null) {
    return [{ path: prefix, message: 'content item must be an object' }];
  }

  const contentItem = item as Record<string, unknown>;

  if (typeof contentItem.type !== 'string' || contentItem.type.length === 0) {
    errors.push({ path: `${prefix}.type`, message: 'type is required' });
  }
  if (typeof contentItem.id !== 'string' || contentItem.id.length === 0) {
    errors.push({ path: `${prefix}.id`, message: 'id is required' });
  }
  if (typeof contentItem.data !== 'object' || contentItem.data === null) {
    errors.push({ path: `${prefix}.data`, message: 'data is required and must be an object' });
  }

  return errors;
}

export function isValidLdif(input: unknown): input is LDIF {
  return validateLdifStructure(input).valid;
}

export function normalizeSourceData(data: Record<string, unknown>): string {
  const sortedKeys = Object.keys(data).sort();
  const normalized: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    normalized[key] = data[key];
  }
  return JSON.stringify(normalized);
}

export interface ParsedRelationPatchPath {
  relationTypeKey: string;
  relationId?: string;
}

/** Parses a patch path like "/relApplicationToITComponent" or "/relApplicationToITComponent/rel-uuid-123". */
export function parseRelationPatchPath(path: string): ParsedRelationPatchPath | null {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0 || !segments[0].startsWith('rel')) {
    return null;
  }
  return {
    relationTypeKey: segments[0],
    relationId: segments[1],
  };
}
