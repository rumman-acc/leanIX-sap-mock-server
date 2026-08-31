import { Injectable, NotFoundException } from '@nestjs/common';
import { TODO_STATUSES } from '@leanix-mock/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { LeanIxException } from '../common/exceptions/leanix.exception';
import { generateId, IdPrefix } from '../common/utils/id-generator';
import { CreateTodoDto, UpdateTodoDto } from '../rest/dto/todo.dto';

export interface TodoResponse<T> {
  status: 'OK';
  data: T;
}

@Injectable()
export class TodoService {
  constructor(private readonly prisma: PrismaService) {}

  private wrap<T>(data: T): TodoResponse<T> {
    return { status: 'OK', data };
  }

  async create(input: CreateTodoDto) {
    if (!input.title || !input.title.trim()) {
      throw new LeanIxException('VALIDATION_ERROR', 'title is required to create a to-do');
    }
    if (input.factSheetId) {
      await this.requireFactSheet(input.factSheetId);
    }

    const todo = await this.prisma.todo.create({
      data: {
        id: generateId(IdPrefix.TODO),
        title: input.title,
        description: input.description,
        factSheetId: input.factSheetId,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
    });
    return this.wrap(todo);
  }

  async list(opts: { factSheetId?: string; status?: string; assigneeId?: string }) {
    const todos = await this.prisma.todo.findMany({
      where: {
        ...(opts.factSheetId ? { factSheetId: opts.factSheetId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.assigneeId ? { assigneeId: opts.assigneeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.wrap(todos);
  }

  async findOne(id: string) {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) {
      throw new LeanIxException('TODO_NOT_FOUND', `To-do "${id}" does not exist`, { id });
    }
    return this.wrap(todo);
  }

  async update(id: string, input: UpdateTodoDto) {
    await this.assertExists(id);
    if (input.status && !TODO_STATUSES.includes(input.status as (typeof TODO_STATUSES)[number])) {
      throw new LeanIxException('VALIDATION_ERROR', `status must be one of ${TODO_STATUSES.join(', ')}`);
    }

    const todo = await this.prisma.todo.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
    });
    return this.wrap(todo);
  }

  async complete(id: string) {
    await this.assertExists(id);
    const todo = await this.prisma.todo.update({ where: { id }, data: { status: 'DONE' } });
    return this.wrap(todo);
  }

  private async assertExists(id: string) {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) {
      throw new NotFoundException(`To-do "${id}" does not exist`);
    }
    return todo;
  }

  private async requireFactSheet(factSheetId: string) {
    const factSheet = await this.prisma.factSheet.findUnique({ where: { id: factSheetId } });
    if (!factSheet) {
      throw new LeanIxException('FACT_SHEET_NOT_FOUND', `Fact sheet "${factSheetId}" does not exist`, { id: factSheetId });
    }
  }
}
