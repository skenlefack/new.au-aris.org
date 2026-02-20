import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('RealtimeService');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  const port = process.env['REALTIME_PORT'] ?? 3008;
  await app.listen(port);
  logger.log(`Realtime service running on port ${port}`);
}

bootstrap();
