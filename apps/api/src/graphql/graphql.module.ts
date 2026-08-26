import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { DateTimeResolver, JSONResolver } from 'graphql-scalars';
import { join } from 'path';
import { MetaModelModule } from '../meta-model/meta-model.module';
import { FactSheetService } from './services/fact-sheet.service';
import { FactSheetPatchService } from './services/fact-sheet-patch.service';
import {
  FactSheetResolver,
  FactSheetConnectionResolver,
  RelationFieldResolver,
  RelationTypeFieldResolver,
} from './resolvers/fact-sheet.resolver';
import { MetaModelResolver } from './resolvers/meta-model.resolver';
import { SearchResolver } from './resolvers/search.resolver';
import { formatGraphQLError } from './graphql-error-formatter';

@Module({
  imports: [
    MetaModelModule,
    NestGraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      path: '/services/pathfinder/v1/graphql',
      typePaths: [join(__dirname, 'schemas/**/*.graphql')],
      resolvers: { DateTime: DateTimeResolver, JSON: JSONResolver },
      introspection: true,
      playground: false,
      // Cast avoids a dual-package-hazard type mismatch between @apollo/server's cjs/esm builds
      // as resolved via this subpath import vs. the main package (harmless at runtime).
      plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true }) as unknown as never],
      context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
      formatError: formatGraphQLError,
    }),
  ],
  providers: [
    FactSheetService,
    FactSheetPatchService,
    FactSheetResolver,
    FactSheetConnectionResolver,
    RelationFieldResolver,
    RelationTypeFieldResolver,
    MetaModelResolver,
    SearchResolver,
  ],
  exports: [FactSheetService, FactSheetPatchService],
})
export class GraphqlModule {}
