import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOtpVerificationsTable1748700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone       VARCHAR(15) NOT NULL,
        otp_hash    VARCHAR(255) NOT NULL,
        purpose     VARCHAR(20) NOT NULL,
        expires_at  TIMESTAMP NOT NULL,
        used_at     TIMESTAMP NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose
        ON otp_verifications (phone, purpose, expires_at)
        WHERE used_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS otp_verifications`);
  }
}
