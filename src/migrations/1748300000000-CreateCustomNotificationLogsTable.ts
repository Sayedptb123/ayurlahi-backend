import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomNotificationLogsTable1748300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS custom_notification_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        target_type VARCHAR(30) NOT NULL,
        organisation_id UUID NULL,
        roles JSONB NULL,
        specific_user_ids JSONB NULL,
        resolved_user_count INTEGER NOT NULL DEFAULT 0,
        sent_by_user_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX idx_custom_notif_logs_created ON custom_notification_logs (created_at DESC);
      CREATE INDEX idx_custom_notif_logs_sent_by ON custom_notification_logs (sent_by_user_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS custom_notification_logs;`);
  }
}
