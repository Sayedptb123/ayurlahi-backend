import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClinicCapabilities1748400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the table
    await queryRunner.query(`
      CREATE TABLE clinic_capabilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organisation_id UUID NOT NULL UNIQUE REFERENCES organisations(id),
        has_postnatal_care BOOLEAN NOT NULL DEFAULT false,
        has_ayurveda BOOLEAN NOT NULL DEFAULT false,
        has_ipd BOOLEAN NOT NULL DEFAULT false,
        has_opd BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_clinic_capabilities_org ON clinic_capabilities(organisation_id)
    `);

    // 2. Insert capabilities for existing POSTNATAL_HOSPITAL orgs (before changing type)
    await queryRunner.query(`
      INSERT INTO clinic_capabilities (organisation_id, has_postnatal_care, has_ayurveda, has_ipd, has_opd)
      SELECT id, true, false, true, true
      FROM organisations
      WHERE type = 'POSTNATAL_HOSPITAL'
    `);

    // 3. Convert POSTNATAL_HOSPITAL → CLINIC
    await queryRunner.query(`
      UPDATE organisations SET type = 'CLINIC' WHERE type = 'POSTNATAL_HOSPITAL'
    `);

    // 4. Insert default capabilities for existing CLINIC orgs that don't have a row yet
    await queryRunner.query(`
      INSERT INTO clinic_capabilities (organisation_id, has_postnatal_care, has_ayurveda, has_ipd, has_opd)
      SELECT id, false, false, false, true
      FROM organisations
      WHERE type = 'CLINIC'
        AND id NOT IN (SELECT organisation_id FROM clinic_capabilities)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS clinic_capabilities`);
  }
}
