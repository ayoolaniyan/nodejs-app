import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProduction = config.get('NODE_ENV') === 'production';

  app.use(
    helmet({
      // The default Content-Security-Policy blocks the scripts that Swagger
      // UI and GraphiQL load, and both are only served outside production.
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );

  // Browsers on other origins are refused unless listed. Previously every
  // origin was allowed.
  const corsOrigins = config
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip properties that have no matching DTO field, and reject the
      // request if any were sent, so clients cannot smuggle extra columns
      // (a `role` of their choosing, for instance) into a write.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Customer API')
      .setDescription('REST and GraphQL API for customer records')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  app.enableShutdownHooks();
  const port = config.get<number>('PORT') ?? 8080;
  await app.listen(port);
  Logger.log(`Listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
