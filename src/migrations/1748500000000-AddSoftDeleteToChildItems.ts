import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteToChildItems1748500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE lab_tests
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE prescription_items
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE lab_tests DROP COLUMN IF EXISTS deleted_at`);
    await queryRunner.query(`ALTER TABLE prescription_items DROP COLUMN IF EXISTS deleted_at`);
  }
}
