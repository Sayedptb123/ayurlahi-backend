import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Run SQL migrations on startup
  const runMigrationFile = async (dataSource: DataSource, filename: string) => {
    try {
      const sqlPath = path.join(process.cwd(), 'src/migrations', filename);
      if (fs.existsSync(sqlPath)) {
        console.log(`🔄 Running SQL migration: ${filename}...`);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await dataSource.query(sql);
        console.log(`✅ SQL migration completed: ${filename}`);
      } else {
        console.warn(`⚠️ Migration SQL file not found at: ${sqlPath}`);
      }
    } catch (error) {
      console.error(`❌ Failed to run SQL migration (${filename}) on startup:`, error.message);
    }
  };

  try {
    const dataSource = app.get(DataSource);
    await runMigrationFile(dataSource, '2026-06-05-leave-management.sql');
    await runMigrationFile(dataSource, '2026-06-05-asset-management.sql');
    await runMigrationFile(dataSource, '2026-06-05-recurring-bills.sql');
  } catch (error) {
    console.error('❌ Failed during database migrations bootstrap:', error.message);
  }

  // Security headers
  app.use(helmet({
    crossOriginEmbedderPolicy: false, // allow Swagger UI to load
  }));

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS — in production restrict to known origins via FRONTEND_URL env var
  const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/]
    : true; // dev: allow all
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger / OpenAPI docs
  const config = new DocumentBuilder()
    .setTitle('Medilink / Ayurlahi API')
    .setDescription('REST API for Medilink — Ayurvedic & Postnatal Healthcare Platform')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('auth', 'Authentication & registration')
    .addTag('patients', 'Patient management')
    .addTag('appointments', 'Appointment scheduling')
    .addTag('medical-records', 'Medical records')
    .addTag('prescriptions', 'Prescriptions')
    .addTag('lab-reports', 'Lab reports')
    .addTag('patient-billing', 'Patient billing')
    .addTag('doctors', 'Doctor management')
    .addTag('staff', 'Staff management')
    .addTag('duty-types', 'Duty types')
    .addTag('duty-assignments', 'Duty roster')
    .addTag('duty-templates', 'Duty templates')
    .addTag('expenses', 'Expense tracking')
    .addTag('budgets', 'Budget management')
    .addTag('payroll', 'Payroll')
    .addTag('inventory', 'Inventory management')
    .addTag('suppliers', 'Supplier management')
    .addTag('purchase-orders', 'Purchase orders')
    .addTag('products', 'Product catalogue')
    .addTag('orders', 'Marketplace orders')
    .addTag('invoices', 'Invoices')
    .addTag('disputes', 'Disputes')
    .addTag('payouts', 'Payouts')
    .addTag('manufacturing', 'Manufacturing ERP')
    .addTag('organisations', 'Organisation management')
    .addTag('analytics', 'Analytics & reporting')
    .addTag('documents', 'Document management')
    .addTag('retreat', 'Retreat / IPD')
    .build();

  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Listen on 0.0.0.0 to be accessible from network
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
