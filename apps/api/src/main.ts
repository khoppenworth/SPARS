import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());

  const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerCfg = new DocumentBuilder()
    .setTitle('SPARS Platform API')
    .setDescription('Builder + Collector API')
    .setVersion('v1')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup('/api/docs', app, doc);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`API listening on http://127.0.0.1:${port}`);
}
bootstrap();
