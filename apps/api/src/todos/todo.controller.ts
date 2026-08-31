import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { TodoService } from './todo.service';
import { CreateTodoDto, UpdateTodoDto, TodoResponseDto, TodoListResponseDto } from '../rest/dto/todo.dto';

// Path per capability map §1.2 (Platform Features Accessible via API / To-Do REST API).
@ApiTags('To-Dos')
@ApiBearerAuth()
@Controller('services/todo/v1')
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Post()
  @HttpCode(201)
  @Roles('ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Create a to-do' })
  @ApiResponse({ status: 201, type: TodoResponseDto })
  create(@Body() body: CreateTodoDto) {
    return this.todoService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'List to-dos, optionally filtered by fact sheet, status, or assignee' })
  @ApiQuery({ name: 'factSheetId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'assigneeId', required: false })
  @ApiResponse({ status: 200, type: TodoListResponseDto })
  list(@Query('factSheetId') factSheetId?: string, @Query('status') status?: string, @Query('assigneeId') assigneeId?: string) {
    return this.todoService.list({ factSheetId, status, assigneeId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a to-do' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: TodoResponseDto })
  findOne(@Param('id') id: string) {
    return this.todoService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Update a to-do' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: TodoResponseDto })
  update(@Param('id') id: string, @Body() body: UpdateTodoDto) {
    return this.todoService.update(id, body);
  }

  @Post(':id/complete')
  @Roles('ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Mark a to-do as done' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: TodoResponseDto })
  complete(@Param('id') id: string) {
    return this.todoService.complete(id);
  }
}
