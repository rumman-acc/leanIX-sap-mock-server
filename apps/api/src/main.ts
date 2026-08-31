import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LeanIxConfig } from './config/leanix.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // `whitelist: true` intentionally NOT set: every REST DTO in this repo is Swagger-only shape
  // documentation with no class-validator decorators (house style — see docs/BUILD_STATUS.md's
  // note on hand-written validation), so class-validator has no per-DTO metadata to whitelist
  // against. With whitelist on, it strips every property from every request body regardless of
  // DTO shape, silently breaking every POST/PUT/PATCH route in the API (found live-verifying the
  // new Comments endpoint: it also broke the pre-existing, previously "verified live" webhook
  // registration endpoint — that verification must predate this pipe being added).
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const configService = app.get(ConfigService);
  const config = configService.get<LeanIxConfig>('leanix')!;

  // A custom application integrating this mock (or later, real LeanIX) typically calls it from
  // a browser on a different origin. Real LeanIX's API is also cross-origin from any consuming
  // app, so permissive CORS here matches that reality rather than diverging from it.
  app.enableCors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('LeanIX Mock Server — REST API')
      .setDescription(
        'REST surface of the LeanIX Development Simulator: auth (MTM), Integration API (LDIF sync), and Webhooks. ' +
          'The Fact Sheet CRUD/query API is GraphQL, not REST — explore it interactively at ' +
          '/services/pathfinder/v1/graphql (GraphQL Playground) instead of here.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .build(),
  );
  SwaggerModule.setup('api-docs', app, swaggerDocument);

  // Bind to 0.0.0.0, not just localhost — required for the port to be reachable when the
  // process runs inside a container/PaaS (e.g. Render), which routes traffic to all interfaces.
  await app.listen(config.port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`LeanIX mock server listening on http://localhost:${config.port}`);
  // eslint-disable-next-line no-console
  console.log(`REST API docs (Swagger UI): http://localhost:${config.port}/api-docs`);
  // eslint-disable-next-line no-console
  console.log(`GraphQL Playground: http://localhost:${config.port}/services/pathfinder/v1/graphql`);
}

bootstrap();
