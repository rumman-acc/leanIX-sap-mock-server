import { EventEmitter2 } from '@nestjs/event-emitter';
import { FactSheetPatchService } from '../../src/graphql/services/fact-sheet-patch.service';
import { LeanIxException } from '../../src/common/exceptions/leanix.exception';

function buildPrismaMock() {
  const mock: any = {
    factSheet: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'fs-1', typeId: 'type-Application', name: 'Old Name' }),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    attribute: { findMany: jest.fn().mockResolvedValue([]) },
    attributeValue: { findMany: jest.fn().mockResolvedValue([]) },
  };
  mock.$transaction = jest.fn(async (fn: any) => fn(mock));
  return mock;
}

describe('FactSheetPatchService', () => {
  const actor = {
    sub: 'user-1',
    iss: 'leanix-mock',
    aud: 'leanix-services',
    iat: 0,
    exp: 0,
    workspaceId: 'ws-development',
    workspaceName: 'development',
    workspaceRole: 'ADMIN' as const,
    userName: 'user-1@mock.local',
  };

  function buildService(prisma: ReturnType<typeof buildPrismaMock>) {
    const factSheetService = {
      requireById: jest.fn().mockResolvedValue({
        id: 'fs-1',
        typeId: 'type-Application',
        type: { technicalKey: 'Application' },
      }),
      recalculateCompletionWithinTx: jest.fn().mockResolvedValue(undefined),
    };
    const metaModel = {};
    const events = new EventEmitter2();
    const service = new FactSheetPatchService(prisma as any, metaModel as any, events, factSheetService as any);
    return { service, factSheetService };
  }

  it('rejects an unsupported patch operation', async () => {
    const prisma = buildPrismaMock();
    const { service } = buildService(prisma);

    await expect(
      service.update('fs-1', [{ op: 'move' as any, path: '/name', value: 'x' }], actor),
    ).rejects.toThrow(LeanIxException);
  });

  it('rejects a patch path without a leading slash', async () => {
    const prisma = buildPrismaMock();
    const { service } = buildService(prisma);

    await expect(
      service.update('fs-1', [{ op: 'replace', path: 'name', value: 'x' }], actor),
    ).rejects.toMatchObject({ code: 'INVALID_PATCH' });
  });

  it('rejects remove on a native field path', async () => {
    const prisma = buildPrismaMock();
    const { service } = buildService(prisma);

    await expect(
      service.update('fs-1', [{ op: 'remove', path: '/name' }], actor),
    ).rejects.toMatchObject({ code: 'INVALID_PATCH' });
  });

  it('applies a replace patch on the name field', async () => {
    const prisma = buildPrismaMock();
    const { service, factSheetService } = buildService(prisma);

    await service.update('fs-1', [{ op: 'replace', path: '/name', value: 'New Name' }], actor);

    expect(prisma.factSheet.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'New Name', displayName: 'New Name' }) }),
    );
    expect(factSheetService.recalculateCompletionWithinTx).toHaveBeenCalled();
  });

  describe('qualitySeal patch (real LeanIX contract — see docs/RESEARCH_LEANIX_REAL_API.md §4)', () => {
    it('accepts the real lowercase form ("approve")', async () => {
      const prisma = buildPrismaMock();
      const { service } = buildService(prisma);

      await service.update('fs-1', [{ op: 'replace', path: '/qualitySeal', value: 'approve' }], actor);

      expect(prisma.factSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ qualitySeal: 'APPROVED' }) }),
      );
    });

    it('accepts this mock\'s own uppercase enum form ("BROKEN")', async () => {
      const prisma = buildPrismaMock();
      const { service } = buildService(prisma);

      await service.update('fs-1', [{ op: 'replace', path: '/qualitySeal', value: 'BROKEN' }], actor);

      expect(prisma.factSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ qualitySeal: 'BROKEN' }) }),
      );
    });

    it('rejects an unrecognized value', async () => {
      const prisma = buildPrismaMock();
      const { service } = buildService(prisma);

      await expect(
        service.update('fs-1', [{ op: 'replace', path: '/qualitySeal', value: 'nonsense' }], actor),
      ).rejects.toMatchObject({ code: 'INVALID_PATCH' });
    });
  });

  describe('lifecycle patches (real LeanIX per-phase form — see docs/RESEARCH_LEANIX_REAL_API.md §4)', () => {
    it('patches a single phase via /lifecycle/{phaseName}, preserving other phases', async () => {
      const prisma = buildPrismaMock();
      prisma.factSheet.findUniqueOrThrow.mockResolvedValue({
        id: 'fs-1',
        typeId: 'type-Application',
        lifecycle: { phases: [{ phase: 'plan', startDate: '2020-01-01' }] },
      });
      const { service } = buildService(prisma);

      await service.update('fs-1', [{ op: 'replace', path: '/lifecycle/phaseIn', value: '2022-07-01' }], actor);

      expect(prisma.factSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lifecycle: {
              phases: [
                { phase: 'plan', startDate: '2020-01-01' },
                { phase: 'phaseIn', startDate: '2022-07-01' },
              ],
            },
          }),
        }),
      );
    });

    it('rejects an unknown phase name', async () => {
      const prisma = buildPrismaMock();
      const { service } = buildService(prisma);

      await expect(
        service.update('fs-1', [{ op: 'replace', path: '/lifecycle/notAPhase', value: '2022-07-01' }], actor),
      ).rejects.toMatchObject({ code: 'INVALID_PATCH' });
    });

    it('parses a stringified-JSON full-replace value (real LeanIX form)', async () => {
      const prisma = buildPrismaMock();
      const { service } = buildService(prisma);

      await service.update(
        'fs-1',
        [{ op: 'replace', path: '/lifecycle', value: '{"phases":[{"phase":"plan","startDate":"2019-01-12"}]}' }],
        actor,
      );

      expect(prisma.factSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lifecycle: { phases: [{ phase: 'plan', startDate: '2019-01-12' }] } }) }),
      );
    });
  });

  describe('externalId patch (real LeanIX structured form — see docs/RESEARCH_LEANIX_REAL_API.md §4)', () => {
    it('unwraps a structured { type, externalId } object to the plain string this mock stores', async () => {
      const prisma = buildPrismaMock();
      const { service } = buildService(prisma);

      await service.update(
        'fs-1',
        [{ op: 'replace', path: '/externalId', value: { type: 'ExternalId', externalId: 'EXT-STRUCT-1' } }],
        actor,
      );

      expect(prisma.factSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ externalId: 'EXT-STRUCT-1' }) }),
      );
    });

    it('still accepts a plain string (mock-only convenience form)', async () => {
      const prisma = buildPrismaMock();
      const { service } = buildService(prisma);

      await service.update('fs-1', [{ op: 'replace', path: '/externalId', value: 'EXT-PLAIN-1' }], actor);

      expect(prisma.factSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ externalId: 'EXT-PLAIN-1' }) }),
      );
    });
  });
});
