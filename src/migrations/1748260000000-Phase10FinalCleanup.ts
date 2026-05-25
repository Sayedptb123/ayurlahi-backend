import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase10FinalCleanup1748260000000 implements MigrationInterface {
  name = 'Phase10FinalCleanup1748260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Fix products.status ───────────────────────────────────────────────
    // Default was 'ACTIVE' (uppercase) which violates the lowercase check constraint.
    // Align: drop old constraint, change default, add new constraint covering both
    // the old uppercase values (still in DB if any) and the new lowercase standard.
    await queryRunner.query(`
      ALTER TABLE products
        DROP CONSTRAINT IF EXISTS chk_product_status;
    `);
    await queryRunner.query(`
      UPDATE products SET status = LOWER(status) WHERE status != LOWER(status);
    `);
    await queryRunner.query(`
      ALTER TABLE products
        ALTER COLUMN status SET DEFAULT 'active';
    `);
    await queryRunner.query(`
      ALTER TABLE products
        ADD CONSTRAINT chk_product_status CHECK (
          status IN ('draft','active','inactive','discontinued','out_of_stock','pending_review','hidden','archived')
        );
    `);

    // ── 2. Drop products.is_active (superseded by status) ────────────────────
    await queryRunner.query(`
      ALTER TABLE products DROP COLUMN IF EXISTS is_active;
    `);

    // ── 3. Migrate staff address columns → JSONB, then drop legacy columns ───
    // Build address JSONB from the 6 legacy columns for rows that don't have it yet.
    await queryRunner.query(`
      UPDATE staff
      SET address = jsonb_build_object(
        'street',   COALESCE(address_street, ''),
        'city',     COALESCE(address_city, ''),
        'district', COALESCE(address_district, ''),
        'state',    COALESCE(address_state, ''),
        'zipCode',  COALESCE(address_zip_code, ''),
        'country',  COALESCE(address_country, '')
      )
      WHERE address IS NULL
        AND (
          address_street   IS NOT NULL OR
          address_city     IS NOT NULL OR
          address_district IS NOT NULL OR
          address_state    IS NOT NULL OR
          address_zip_code IS NOT NULL OR
          address_country  IS NOT NULL
        );
    `);
    await queryRunner.query(`ALTER TABLE staff DROP COLUMN IF EXISTS address_street;`);
    await queryRunner.query(`ALTER TABLE staff DROP COLUMN IF EXISTS address_city;`);
    await queryRunner.query(`ALTER TABLE staff DROP COLUMN IF EXISTS address_district;`);
    await queryRunner.query(`ALTER TABLE staff DROP COLUMN IF EXISTS address_state;`);
    await queryRunner.query(`ALTER TABLE staff DROP COLUMN IF EXISTS address_zip_code;`);
    await queryRunner.query(`ALTER TABLE staff DROP COLUMN IF EXISTS address_country;`);

    // ── 4. Add CHECK(current_stock >= 0) to inventory_items ─────────────────
    await queryRunner.query(`
      ALTER TABLE inventory_items
        ADD CONSTRAINT chk_inventory_stock_non_negative
        CHECK (current_stock >= 0);
    `);

    // ── 5. Drop legacy global unique on patient_bills.bill_number ────────────
    // We already have UNIQUE(organisation_id, bill_number) partial index.
    // The old global unique breaks multi-tenant bill numbering.
    await queryRunner.query(`
      ALTER TABLE patient_bills
        DROP CONSTRAINT IF EXISTS "patient_bills_billNumber_key";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE patient_bills ADD CONSTRAINT "patient_bills_billNumber_key" UNIQUE (bill_number);`);
    await queryRunner.query(`ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_stock_non_negative;`);
    await queryRunner.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS address_street text;`);
    await queryRunner.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS address_city varchar(100);`);
    await queryRunner.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS address_district varchar(100);`);
    await queryRunner.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS address_state varchar(100);`);
    await queryRunner.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS address_zip_code varchar(20);`);
    await queryRunner.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS address_country varchar(100);`);
    await queryRunner.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;`);
    await queryRunner.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_product_status;`);
    await queryRunner.query(`ALTER TABLE products ALTER COLUMN status SET DEFAULT 'ACTIVE';`);
  }
}
