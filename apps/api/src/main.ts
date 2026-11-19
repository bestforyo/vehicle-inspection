import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { createNestApp } from './app.setup';

async function bootstrap() {
  const app = await createNestApp();
  const config = app.get(ConfigService);
  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
}

void bootstrap();
