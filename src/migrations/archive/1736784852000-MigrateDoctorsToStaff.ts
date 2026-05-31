import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class MigrateDoctorsToStaff1736784852000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('Starting migration: Doctors to Staff');

        // Step 1: Add migrated_to_staff_id column to doctors table for tracking
        await queryRunner.addColumn(
            'doctors',
            new TableColumn({
                name: 'migrated_to_staff_id',
                type: 'uuid',
                isNullable: true,
            }),
        );

        // Step 2: Copy all doctors to staff table
        await queryRunner.query(`
            INSERT INTO staff (
                id,
                first_name,
                last_name,
                email,
                phone,
                position,
                position_custom,
                date_of_joining,
                is_active,
                organisation_id,
                specialization,
                created_at,
                updated_at
            )
            SELECT 
                gen_random_uuid(),
                "firstName",
                "lastName",
                email,
                phone,
                'doctor',
                NULL,
                NULL,
                COALESCE("isActive", true),
                "clinicId",
                specialization,
                "createdAt",
                "updatedAt"
            FROM doctors
            WHERE NOT EXISTS (
                SELECT 1 FROM staff 
                WHERE staff.email = doctors.email 
                AND staff.organisation_id = doctors."clinicId"
            )
        `);

        console.log('Doctors copied to staff table');

        // Step 3: Update doctors table with staff IDs for reference
        await queryRunner.query(`
            UPDATE doctors d
            SET migrated_to_staff_id = s.id
            FROM staff s
            WHERE s.email = d.email
            AND s.organisation_id = d."clinicId"
            AND s.position = 'doctor'
        `);

        // Step 4: Add staffId column to appointments table
        const appointmentsTableExists = await queryRunner.hasTable('appointments');
        if (appointmentsTableExists) {
            await queryRunner.addColumn(
                'appointments',
                new TableColumn({
                    name: 'staffId',
                    type: 'uuid',
                    isNullable: true,
                }),
            );

            // Step 5: Migrate appointment.doctorId to appointment.staffId
            await queryRunner.query(`
                UPDATE appointments a
                SET "staffId" = d.migrated_to_staff_id
                FROM doctors d
                WHERE a."doctorId" = d.id
                AND d.migrated_to_staff_id IS NOT NULL
            `);

            console.log('Appointments updated with staffId');
        }

        // Step 6: Add staffId column to prescriptions table if it exists
        const prescriptionsTableExists = await queryRunner.hasTable('prescriptions');
        if (prescriptionsTableExists) {
            const hasDoctorId = await queryRunner.hasColumn('prescriptions', 'doctorId');
            if (hasDoctorId) {
                await queryRunner.addColumn(
                    'prescriptions',
                    new TableColumn({
                        name: 'staffId',
                        type: 'uuid',
                        isNullable: true,
                    }),
                );

                // Migrate prescription.doctorId to prescription.staffId
                await queryRunner.query(`
                    UPDATE prescriptions p
                    SET "staffId" = d.migrated_to_staff_id
                    FROM doctors d
                    WHERE p."doctorId" = d.id
                    AND d.migrated_to_staff_id IS NOT NULL
                `);

                console.log('Prescriptions updated with staffId');
            }
        }

        // Step 7: Add index on staff.position for performance
        await queryRunner.createIndex(
            'staff',
            new TableIndex({
                name: 'IDX_STAFF_POSITION',
                columnNames: ['position'],
            }),
        );

        // Step 8: Add composite index for common queries
        await queryRunner.createIndex(
            'staff',
            new TableIndex({
                name: 'IDX_STAFF_ORG_POSITION',
                columnNames: ['organisation_id', 'position', 'is_active'],
            }),
        );

        console.log('Migration completed successfully');
        console.log('Note: doctors table is kept for reference. doctorId columns in appointments/prescriptions are also kept for backward compatibility.');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('Rolling back migration: Doctors to Staff');

        // Remove indexes
        await queryRunner.dropIndex('staff', 'IDX_STAFF_POSITION');
        await queryRunner.dropIndex('staff', 'IDX_STAFF_ORG_POSITION');

        // Remove staffId from prescriptions if exists
        const prescriptionsTableExists = await queryRunner.hasTable('prescriptions');
        if (prescriptionsTableExists) {
            const hasStaffId = await queryRunner.hasColumn('prescriptions', 'staffId');
            if (hasStaffId) {
                await queryRunner.dropColumn('prescriptions', 'staffId');
            }
        }

        // Remove staffId from appointments if exists
        const appointmentsTableExists = await queryRunner.hasTable('appointments');
        if (appointmentsTableExists) {
            const hasStaffId = await queryRunner.hasColumn('appointments', 'staffId');
            if (hasStaffId) {
                await queryRunner.dropColumn('appointments', 'staffId');
            }
        }

        // Remove migrated_to_staff_id from doctors
        await queryRunner.dropColumn('doctors', 'migrated_to_staff_id');

        // Delete migrated doctors from staff table
        await queryRunner.query(`
            DELETE FROM staff WHERE position = 'doctor'
        `);

        console.log('Rollback completed');
    }
}
