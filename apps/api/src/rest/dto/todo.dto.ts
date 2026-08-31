import { ApiProperty } from '@nestjs/swagger';
import { TODO_STATUSES } from '@leanix-mock/shared';

export class CreateTodoDto {
  @ApiProperty({ example: 'Confirm owner for SAP CRM' })
  title!: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false, description: 'Fact sheet this to-do relates to' })
  factSheetId?: string;

  @ApiProperty({ required: false, description: 'User id of the assignee' })
  assigneeId?: string;

  @ApiProperty({ required: false, example: '2026-09-30T00:00:00.000Z' })
  dueDate?: string;
}

export class UpdateTodoDto {
  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false, enum: TODO_STATUSES })
  status?: string;

  @ApiProperty({ required: false })
  assigneeId?: string;

  @ApiProperty({ required: false })
  dueDate?: string;
}

export class TodoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ enum: TODO_STATUSES })
  status!: string;

  @ApiProperty({ required: false })
  factSheetId?: string;

  @ApiProperty({ required: false })
  assigneeId?: string;

  @ApiProperty({ required: false })
  dueDate?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class TodoResponseDto {
  @ApiProperty({ example: 'OK' })
  status!: string;

  @ApiProperty({ type: TodoDto })
  data!: TodoDto;
}

export class TodoListResponseDto {
  @ApiProperty({ example: 'OK' })
  status!: string;

  @ApiProperty({ type: [TodoDto] })
  data!: TodoDto[];
}
