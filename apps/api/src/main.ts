import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LeanIxConfig } from './config/leanix.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const configService = app.get(ConfigService);
  const config = configService.get<LeanIxConfig>('leanix')!;

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(`LeanIX mock server listening on http://localhost:${config.port}`);
}

bootstrap();
