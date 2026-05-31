
import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRoomBookingForeignKey1736783550000 implements MigrationInterface {
    name = 'UpdateRoomBookingForeignKey1736783550000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop old constraint for clinics
        await queryRunner.query(`ALTER TABLE "room_bookings" DROP CONSTRAINT IF EXISTS "fk_booking_clinic"`);
        await queryRunner.query(`ALTER TABLE "room_bookings" DROP CONSTRAINT IF EXISTS "FK_room_bookings_clinicId"`);

        // Add new constraint for organisations
        await queryRunner.query(`ALTER TABLE "room_bookings" ADD CONSTRAINT "fk_booking_organisation" FOREIGN KEY ("clinicId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "room_bookings" DROP CONSTRAINT "fk_booking_organisation"`);
        await queryRunner.query(`ALTER TABLE "room_bookings" ADD CONSTRAINT "fk_booking_clinic" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
}
