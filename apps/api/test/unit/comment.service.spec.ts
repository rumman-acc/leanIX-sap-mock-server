import { CommentService } from '../../src/comments/comment.service';
import { LeanIxException } from '../../src/common/exceptions/leanix.exception';

function buildPrismaMock() {
  return {
    factSheet: { findUnique: jest.fn() },
    comment: { create: jest.fn(), findMany: jest.fn() },
  };
}

describe('CommentService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: CommentService;

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

  const author = { id: 'user-1', name: 'User One', email: 'user-1@mock.local' };

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new CommentService(prisma as any);
  });

  it('creates a comment on an existing fact sheet', async () => {
    prisma.factSheet.findUnique.mockResolvedValue({ id: 'fs-1' });
    prisma.comment.create.mockResolvedValue({
      id: 'comment-1',
      factSheetId: 'fs-1',
      message: 'hello',
      createdAt: new Date('2026-01-01'),
      user: author,
    });

    const result = await service.create('fs-1', 'hello', actor);

    expect(result.status).toBe('OK');
    expect(result.data.message).toBe('hello');
    expect(result.data.author).toEqual(author);
    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ factSheetId: 'fs-1', userId: 'user-1', message: 'hello' }) }),
    );
  });

  it('rejects a comment on a nonexistent fact sheet', async () => {
    prisma.factSheet.findUnique.mockResolvedValue(null);

    await expect(service.create('missing', 'hello', actor)).rejects.toThrow(LeanIxException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('rejects an empty message', async () => {
    prisma.factSheet.findUnique.mockResolvedValue({ id: 'fs-1' });

    await expect(service.create('fs-1', '   ', actor)).rejects.toThrow(LeanIxException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('lists comments for a fact sheet ordered by creation time', async () => {
    prisma.factSheet.findUnique.mockResolvedValue({ id: 'fs-1' });
    prisma.comment.findMany.mockResolvedValue([
      { id: 'comment-1', factSheetId: 'fs-1', message: 'first', createdAt: new Date('2026-01-01'), user: author },
    ]);

    const result = await service.listForFactSheet('fs-1');

    expect(result.data).toHaveLength(1);
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { factSheetId: 'fs-1' }, orderBy: { createdAt: 'asc' } }),
    );
  });
});
