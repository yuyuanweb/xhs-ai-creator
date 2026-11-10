import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // 整份卡片稿和外部 Agent 交来的初稿都是几十 KB 的中文 JSON，默认的 100kb 上限经常不够
  app.useBodyParser('json', { limit: '5mb' });
  app.enableCors({
    origin: parseOrigins(config.get<string>('CORS_ORIGIN', 'http://localhost:18473')),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // 转存后的原文配图。导出时前端要把它们读成 data URI，所以必须同源可读
  app.useStaticAssets(join(process.cwd(), config.get<string>('STORAGE_DIR', './storage')), {
    prefix: config.get<string>('STORAGE_PUBLIC_PREFIX', '/static'),
  });

  await app.listen(config.get<number>('PORT', 18472));
}

function parseOrigins(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

void bootstrap();
