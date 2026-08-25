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
});
