import { Args, Query, Resolver } from '@nestjs/graphql';
import { JwtClaims } from '@leanix-mock/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FactSheetService } from '../services/fact-sheet.service';

@Resolver('SearchResult')
export class SearchResolver {
  constructor(private readonly factSheetService: FactSheetService) {}

  @Query('search')
  search(@Args('query') query: string, @Args('first') first: number | undefined, @Args('after') after: string | undefined, @CurrentUser() user: JwtClaims) {
    return this.factSheetService.search(query, first, after, user.workspaceId);
  }
}
