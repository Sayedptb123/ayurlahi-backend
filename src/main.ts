import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BodyValidationPipe } from './common/pipes/body-validation.pipe';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
    : process.env.NODE_ENV === 'production'
      ? [] // In production, require FRONTEND_URL to be set
      : ['http://localhost:5173', 'http://localhost:3000']; // Development defaults

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe - only validates @Body() parameters
  // This prevents validation of entities passed via @CurrentUser() or other custom decorators
  app.useGlobalPipes(new BodyValidationPipe());

  // Swagger/OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Ayurlahi API')
    .setDescription('B2B Marketplace API for Ayurvedic Medicines')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .addServer('http://localhost:3000', 'Development server')
    .addServer('https://api.ayurlahi.com', 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Persist auth token in Swagger UI
    },
  });

  // Export OpenAPI spec to file (for type generation)
  if (process.env.NODE_ENV !== 'production') {
    const fs = require('fs');
    const path = require('path');
    const specPath = path.join(__dirname, '..', 'api-spec', 'openapi.json');
    require('fs').mkdirSync(path.dirname(specPath), { recursive: true });
    fs.writeFileSync(specPath, JSON.stringify(document, null, 2));
    console.log(`✅ OpenAPI spec exported to: ${specPath}`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`📄 OpenAPI Spec: http://localhost:${port}/api/docs-json`);
}

bootstrap();
