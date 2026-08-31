import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { FactSheetService } from '../../src/graphql/services/fact-sheet.service';
import { MetaModelService } from '../../src/meta-model/meta-model.service';
import { LeanIxException } from '../../src/common/exceptions/leanix.exception';

function buildPrismaMock() {
  const mock: any = {
    factSheet: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    attribute: { findMany: jest.fn().mockResolvedValue([]) },
    attributeValue: { findMany: jest.fn().mockResolvedValue([]) },
  };
  // Transactions in these unit tests just run the callback against the same mock instance,
  // so jest.fn() setup on `prisma.factSheet.*` is visible inside the transaction too.
  mock.$transaction = jest.fn(async (fn: any) => fn(mock));
  return mock;
}

describe('FactSheetService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let metaModel: Partial<MetaModelService>;
  let events: EventEmitter2;
  let configService: ConfigService;
  let service: FactSheetService;

  const APPLICATION_TYPE = { id: 'type-Application', technicalKey: 'Application' };

  beforeEach(() => {
    prisma = buildPrismaMock();
    metaModel = {
      requireTypeByKey: jest.fn().mockResolvedValue(APPLICATION_TYPE),
    };
    events = new EventEmitter2();
    configService = { get: jest.fn().mockReturnValue({ trashBinRetentionDays: 90 }) } as unknown as ConfigService;
    service = new FactSheetService(prisma as any, metaModel as MetaModelService, events, configService);
  });

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

  it('creates a fact sheet with required fields and defaults', async () => {
    prisma.factSheet.findFirst.mockResolvedValue(null);
    prisma.factSheet.create.mockResolvedValue({ id: 'fs-1' });
    prisma.factSheet.findUniqueOrThrow.mockResolvedValue({
      id: 'fs-1',
      name: 'Test App',
      type: APPLICATION_TYPE,
      externalId: null,
      status: 'ACTIVE',
      qualitySeal: 'BROKEN',
    });

    const result = await service.create({ name: 'Test App', type: 'Application' }, actor);

    expect(result.name).toBe('Test App');
    expect(result.status).toBe('ACTIVE');
    expect(result.qualitySeal).toBe('BROKEN');
    expect(prisma.factSheet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Test App', status: 'ACTIVE', qualitySeal: 'BROKEN', createdBy: 'user-1' }),
      }),
    );
  });

  it('rejects an empty name', async () => {
    await expect(service.create({ name: '  ', type: 'Application' }, actor)).rejects.toThrow(LeanIxException);
  });

  it('rejects a duplicate externalId within the same type', async () => {
    prisma.factSheet.findFirst.mockResolvedValue({ id: 'existing-fs' });

    await expect(
      service.create({ name: 'App2', type: 'Application', externalId: 'EXT-001' }, actor),
    ).rejects.toMatchObject({ code: 'DUPLICATE_EXTERNAL_ID' });
  });

  it('throws FACT_SHEET_NOT_FOUND when archiving a missing fact sheet', async () => {
    prisma.factSheet.findUnique.mockResolvedValue(null);
    await expect(service.archive('missing-id', actor)).rejects.toMatchObject({ code: 'FACT_SHEET_NOT_FOUND' });
  });

  it('treats a fact sheet in a different workspace as not found', async () => {
    prisma.factSheet.findUnique.mockResolvedValue({ id: 'fs-1', workspaceId: 'ws-other-tenant' });

    const found = await service.findById('fs-1', 'ws-development');

    expect(found).toBeNull();
  });

  it('returns a fact sheet when the workspace matches', async () => {
    prisma.factSheet.findUnique.mockResolvedValue({ id: 'fs-1', workspaceId: 'ws-development' });

    const found = await service.findById('fs-1', 'ws-development');

    expect(found).toEqual({ id: 'fs-1', workspaceId: 'ws-development' });
  });

  it('scopes new fact sheets to the creating actor\'s workspace', async () => {
    prisma.factSheet.findFirst.mockResolvedValue(null);
    prisma.factSheet.create.mockResolvedValue({ id: 'fs-1' });
    prisma.factSheet.findUniqueOrThrow.mockResolvedValue({
      id: 'fs-1',
      name: 'Test App',
      type: APPLICATION_TYPE,
      externalId: null,
      status: 'ACTIVE',
      qualitySeal: 'BROKEN',
    });

    await service.create({ name: 'Test App', type: 'Application' }, actor);

    expect(prisma.factSheet.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: 'ws-development' }) }),
    );
    expect(metaModel.requireTypeByKey).toHaveBeenCalledWith('ws-development', 'Application');
  });
});
