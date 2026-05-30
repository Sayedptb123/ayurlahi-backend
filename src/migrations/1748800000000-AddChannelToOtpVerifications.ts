import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChannelToOtpVerifications1748800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Rename phone → identifier and extend length to fit emails
    await queryRunner.query(`
      ALTER TABLE otp_verifications
        RENAME COLUMN phone TO identifier
    `);
    await queryRunner.query(`
      ALTER TABLE otp_verifications
        ALTER COLUMN identifier TYPE VARCHAR(255)
    `);
    // Add channel column
    await queryRunner.query(`
      ALTER TABLE otp_verifications
        ADD COLUMN channel VARCHAR(10) NOT NULL DEFAULT 'sms'
    `);
    // Drop old index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_otp_phone_purpose`);
    // New index on identifier + purpose
    await queryRunner.query(`
      CREATE INDEX idx_otp_identifier_purpose
        ON otp_verifications (identifier, purpose, expires_at)
        WHERE used_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_otp_identifier_purpose`);
    await queryRunner.query(`ALTER TABLE otp_verifications DROP COLUMN channel`);
    await queryRunner.query(`ALTER TABLE otp_verifications ALTER COLUMN identifier TYPE VARCHAR(15)`);
    await queryRunner.query(`ALTER TABLE otp_verifications RENAME COLUMN identifier TO phone`);
    await queryRunner.query(`
      CREATE INDEX idx_otp_phone_purpose
        ON otp_verifications (phone, purpose, expires_at)
        WHERE used_at IS NULL
    `);
  }
}
