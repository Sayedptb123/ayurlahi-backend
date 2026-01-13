const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ayurlahi',
});

const createTablesSql = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "raw_materials" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "manufacturer_id" uuid NOT NULL,
  "name" character varying(255) NOT NULL,
  "description" text,
  "sku" character varying(100) NOT NULL,
  "unit" character varying(50) NOT NULL,
  "current_stock" numeric(10,3) NOT NULL DEFAULT '0',
  "reorder_point" numeric(10,3) NOT NULL DEFAULT '0',
  "is_active" boolean NOT NULL DEFAULT true,
  "expiry_date" date,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_raw_materials_sku" UNIQUE ("sku"),
  CONSTRAINT "PK_raw_materials" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "manufacturing_formulas" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "manufacturer_id" uuid NOT NULL,
  "name" character varying(255) NOT NULL,
  "description" text,
  "target_product_id" uuid,
  "standard_batch_size" numeric(10,3) NOT NULL,
  "unit" character varying(50) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_manufacturing_formulas" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "formula_items" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "formula_id" uuid NOT NULL,
  "raw_material_id" uuid NOT NULL,
  "quantity" numeric(10,3) NOT NULL,
  "stage" character varying(100),
  "notes" text,
  CONSTRAINT "PK_formula_items" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "process_stages" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "manufacturer_id" uuid NOT NULL,
  "name" character varying(100) NOT NULL,
  "description" text,
  "order" integer NOT NULL DEFAULT '0',
  "requires_machine" boolean NOT NULL DEFAULT false,
  "requires_qc" boolean NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_process_stages" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "equipment" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "manufacturer_id" uuid NOT NULL,
  "name" character varying(100) NOT NULL,
  "model" character varying(50),
  "serial_number" character varying(50),
  "last_maintenance_date" date,
  "next_maintenance_date" date,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_equipment" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "batches" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "manufacturer_id" uuid NOT NULL,
  "batch_number" character varying(50) NOT NULL,
  "formula_id" uuid,
  "target_product_id" uuid,
  "planned_quantity" numeric(10,3) NOT NULL,
  "actual_yield" numeric(10,3),
  "status" character varying(50) NOT NULL,
  "start_date" date,
  "completion_date" date,
  "expiry_date" date,
  "total_material_cost" numeric(12,2) NOT NULL DEFAULT '0',
  "total_overhead_cost" numeric(12,2) NOT NULL DEFAULT '0',
  "cost_per_unit" numeric(12,2) NOT NULL DEFAULT '0',
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_batches_batch_number" UNIQUE ("batch_number"),
  CONSTRAINT "PK_batches" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "batch_stages" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "batch_id" uuid NOT NULL,
  "process_stage_id" uuid,
  "name" character varying(100) NOT NULL,
  "status" character varying(50) NOT NULL DEFAULT 'PENDING',
  "started_at" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "completed_by" uuid,
  "notes" text,
  "order" integer NOT NULL,
  CONSTRAINT "PK_batch_stages" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_transactions" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "manufacturer_id" uuid NOT NULL,
  "raw_material_id" uuid,
  "product_id" uuid,
  "transaction_type" character varying(50) NOT NULL,
  "quantity" numeric(10,3) NOT NULL,
  "unit_cost" numeric(10,2),
  "batch_id" uuid,
  "notes" text,
  "transaction_date" TIMESTAMP NOT NULL DEFAULT now(),
  "performed_by" uuid,
  CONSTRAINT "PK_inventory_transactions" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "wastage_logs" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "batch_id" uuid NOT NULL,
  "stage_id" uuid,
  "raw_material_id" uuid,
  "quantity" numeric(10,3) NOT NULL,
  "unit" character varying(50) NOT NULL,
  "reason" text,
  "recorded_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_wastage_logs" PRIMARY KEY ("id")
);
`;

async function run() {
    try {
        await client.connect();
        console.log('Connected to database');

        await client.query(createTablesSql);
        console.log('Manufacturing tables created successfully');

    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        await client.end();
    }
}

run();
