import { Args, Query, Resolver } from '@nestjs/graphql';
import { FactSheetService } from '../services/fact-sheet.service';

@Resolver('SearchResult')
export class SearchResolver {
  constructor(private readonly factSheetService: FactSheetService) {}

  @Query('search')
  search(@Args('query') query: string, @Args('first') first?: number, @Args('after') after?: string) {
    return this.factSheetService.search(query, first, after);
  }
}
