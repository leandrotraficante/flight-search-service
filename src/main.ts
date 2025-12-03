// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Obtener AppConfigService del contenedor de NestJS
  const configService = app.get(AppConfigService);

  await app.listen(configService.port);
}
bootstrap();
