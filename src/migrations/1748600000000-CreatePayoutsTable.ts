import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayoutsTable1748600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organisation_id   UUID NOT NULL REFERENCES organisations(id),
        order_id          UUID NULL REFERENCES orders(id),
        amount            NUMERIC(12, 2) NOT NULL,
        status            VARCHAR(20) NOT NULL DEFAULT 'pending',
        transaction_ref   VARCHAR(255) NULL,
        notes             TEXT NULL,
        created_at        TIMESTAMP NOT NULL DEFAULT now(),
        updated_at        TIMESTAMP NOT NULL DEFAULT now(),
        deleted_at        TIMESTAMP NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payouts_org_status
        ON payouts (organisation_id, status, created_at DESC)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_payouts_order_id
        ON payouts (order_id)
        WHERE order_id IS NOT NULL AND deleted_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS payouts`);
  }
}
