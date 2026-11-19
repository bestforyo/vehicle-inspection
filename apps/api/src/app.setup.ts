import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './http-exception.filter';

export async function createNestApp() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: config.getOrThrow<string>('CORS_ORIGINS').split(','), credentials: false, maxAge: 600 });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  return app;
}
