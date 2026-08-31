import { NotFoundException } from '@nestjs/common';
import { TodoService } from '../../src/todos/todo.service';
import { LeanIxException } from '../../src/common/exceptions/leanix.exception';

function buildPrismaMock() {
  return {
    factSheet: { findUnique: jest.fn() },
    todo: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
}

describe('TodoService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: TodoService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new TodoService(prisma as any);
  });

  it('creates a to-do without a fact sheet link', async () => {
    prisma.todo.create.mockResolvedValue({ id: 'todo-1', title: 'Follow up', status: 'OPEN' });

    const result = await service.create({ title: 'Follow up' });

    expect(result.data.status).toBe('OPEN');
    expect(prisma.factSheet.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an empty title', async () => {
    await expect(service.create({ title: '  ' })).rejects.toThrow(LeanIxException);
    expect(prisma.todo.create).not.toHaveBeenCalled();
  });

  it('rejects a to-do linked to a nonexistent fact sheet', async () => {
    prisma.factSheet.findUnique.mockResolvedValue(null);

    await expect(service.create({ title: 'x', factSheetId: 'missing' })).rejects.toThrow(LeanIxException);
    expect(prisma.todo.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException updating a missing to-do', async () => {
    prisma.todo.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { title: 'x' })).rejects.toThrow(NotFoundException);
  });

  it('rejects an invalid status transition', async () => {
    prisma.todo.findUnique.mockResolvedValue({ id: 'todo-1', status: 'OPEN' });

    await expect(service.update('todo-1', { status: 'CANCELLED' })).rejects.toThrow(LeanIxException);
  });

  it('marks a to-do as done', async () => {
    prisma.todo.findUnique.mockResolvedValue({ id: 'todo-1', status: 'OPEN' });
    prisma.todo.update.mockResolvedValue({ id: 'todo-1', status: 'DONE' });

    const result = await service.complete('todo-1');

    expect(result.data.status).toBe('DONE');
    expect(prisma.todo.update).toHaveBeenCalledWith({ where: { id: 'todo-1' }, data: { status: 'DONE' } });
  });
});
