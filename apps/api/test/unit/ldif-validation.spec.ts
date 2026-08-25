import { validateLdifStructure } from '@leanix-mock/shared';

describe('validateLdifStructure', () => {
  const validLdif = {
    connectorType: 'test',
    connectorId: 'test-1',
    connectorVersion: '1.0.0',
    lxVersion: '1.0.0',
    processingDirection: 'inbound',
    processingMode: 'partial',
    content: [{ type: 'Application', id: 'SRC-001', data: { name: 'Test App' } }],
  };

  it('accepts a well-formed LDIF payload', () => {
    expect(validateLdifStructure(validLdif)).toEqual({ valid: true, errors: [] });
  });

  it('rejects a payload missing required header fields', () => {
    const { valid, errors } = validateLdifStructure({ content: [] });
    expect(valid).toBe(false);
    expect(errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(['connectorType', 'connectorId', 'connectorVersion', 'lxVersion', 'processingDirection', 'processingMode']),
    );
  });

  it('rejects an invalid processingMode', () => {
    const { valid, errors } = validateLdifStructure({ ...validLdif, processingMode: 'bogus' });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.path === 'processingMode')).toBe(true);
  });

  it('rejects a content item missing type/id/data', () => {
    const { valid, errors } = validateLdifStructure({ ...validLdif, content: [{}] });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.path === 'content[0].type')).toBe(true);
    expect(errors.some((e) => e.path === 'content[0].id')).toBe(true);
    expect(errors.some((e) => e.path === 'content[0].data')).toBe(true);
  });
});
