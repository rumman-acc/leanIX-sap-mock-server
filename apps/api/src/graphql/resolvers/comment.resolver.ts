import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { JwtClaims } from '@leanix-mock/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CommentService } from '../../comments/comment.service';

@Resolver()
export class CommentResolver {
  constructor(private readonly commentService: CommentService) {}

  @Mutation('createComment')
  async createComment(@Args('factSheetId') factSheetId: string, @Args('message') message: string, @CurrentUser() user: JwtClaims) {
    const { data } = await this.commentService.create(factSheetId, message, user);
    return data;
  }
}
