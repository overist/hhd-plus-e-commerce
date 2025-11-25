import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// session modules
import session from 'express-session';
import Redis from 'ioredis';
import { RedisStore } from 'connect-redis';

// validation and exception modules
import { ValidationPipe } from '@nestjs/common';
import { DomainExceptionFilter } from '@common/exception/domain-exception.filter';
import { ApplicationExceptionFilter } from '@common/exception/application-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Exception Filters
  app.useGlobalFilters(
    new DomainExceptionFilter(),
    new ApplicationExceptionFilter(),
  );

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Redis Session Store
  const redisClient = new Redis(process.env.REDIS_URL as string);
  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
  });
  app.use(
    session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET as string,
      cookie: { maxAge: 12 * 60 * 60 * 1000 },
    }),
  );

  // Swagger Setup
  if (process.env.NODE_ENV !== 'production') {
    const swagger = await import('@nestjs/swagger');
    const DocumentBuilder = swagger.DocumentBuilder;
    const SwaggerModule = swagger.SwaggerModule;

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Points API')
      .setDescription('The points API description')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  // Start Application
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
