import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
    console.log('Creating Retreat Schema Manually...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);
    const queryRunner = dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
        console.log('Dropping existing tables to clean state...');
        await queryRunner.query(`DROP TABLE IF EXISTS "admissions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "treatment_packages"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "rooms"`);

        console.log('Creating Rooms Table...');
        await queryRunner.query(`
            CREATE TABLE "rooms" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "clinicId" uuid NOT NULL,
                "roomNumber" character varying(50) NOT NULL,
                "floor" character varying(50),
                "type" character varying(50) NOT NULL DEFAULT 'PRIVATE',
                "status" character varying(50) NOT NULL DEFAULT 'AVAILABLE',
                "price_per_day" numeric(10,2) NOT NULL DEFAULT '0',
                "amenities" jsonb,
                "description" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_rooms_id" PRIMARY KEY ("id")
            )
        `);

        console.log('Creating Treatment Packages Table...');
        await queryRunner.query(`
            CREATE TABLE "treatment_packages" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "clinicId" uuid NOT NULL,
                "name" character varying(255) NOT NULL,
                "description" text,
                "duration_days" integer NOT NULL DEFAULT '1',
                "price" numeric(10,2) NOT NULL DEFAULT '0',
                "inclusions" jsonb,
                "image_url" character varying(500),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_packages_id" PRIMARY KEY ("id")
            )
        `);

        console.log('Creating Admissions Table...');
        await queryRunner.query(`
            CREATE TABLE "admissions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "clinicId" uuid NOT NULL,
                "patientId" uuid NOT NULL,
                "roomId" uuid NOT NULL,
                "packageId" uuid,
                "check_in_date" TIMESTAMP NOT NULL,
                "expected_check_out_date" TIMESTAMP,
                "actual_check_out_date" TIMESTAMP,
                "status" character varying(50) NOT NULL DEFAULT 'ACTIVE',
                "notes" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_admissions_id" PRIMARY KEY ("id")
            )
        `);

        console.log('✅ Schema Created Successfully.');

    } catch (err) {
        console.error('Schema creation failed:', err);
    } finally {
        await queryRunner.release();
        await app.close();
    }
}

bootstrap();
