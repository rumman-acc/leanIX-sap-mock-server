import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtClaims } from '@leanix-mock/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CommentService } from './comment.service';
import { CreateCommentDto, CommentResponseDto, CommentListResponseDto } from '../rest/dto/comment.dto';

// Path per LeanIX_Mock_Server_Scope.md §3: /services/pathfinder/v1/factSheets/{id}/comments.
@ApiTags('Comments')
@ApiBearerAuth()
@Controller('services/pathfinder/v1/factSheets/:factSheetId/comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get()
  @ApiOperation({ summary: 'List comments on a fact sheet' })
  @ApiParam({ name: 'factSheetId' })
  @ApiResponse({ status: 200, type: CommentListResponseDto })
  list(@Param('factSheetId') factSheetId: string) {
    return this.commentService.listForFactSheet(factSheetId);
  }

  @Post()
  @HttpCode(201)
  @Roles('ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Add a comment to a fact sheet' })
  @ApiParam({ name: 'factSheetId' })
  @ApiResponse({ status: 201, type: CommentResponseDto })
  create(@Param('factSheetId') factSheetId: string, @Body() body: CreateCommentDto, @CurrentUser() user: JwtClaims) {
    return this.commentService.create(factSheetId, body.message, user);
  }
}
