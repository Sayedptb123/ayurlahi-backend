import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateRoomBookingsTable1736783545000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'room_bookings',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'clinicId',
                        type: 'uuid',
                    },
                    {
                        name: 'patientId',
                        type: 'uuid',
                    },
                    {
                        name: 'roomId',
                        type: 'uuid',
                    },
                    {
                        name: 'packageId',
                        type: 'uuid',
                        isNullable: true,
                    },
                    {
                        name: 'checkInDate',
                        type: 'date',
                    },
                    {
                        name: 'checkOutDate',
                        type: 'date',
                    },
                    {
                        name: 'totalPrice',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                    },
                    {
                        name: 'advancePaid',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        default: 0,
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED'],
                        default: "'PENDING'",
                    },
                    {
                        name: 'notes',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'bookingDate',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'admissionId',
                        type: 'uuid',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Add foreign keys
        await queryRunner.createForeignKey(
            'room_bookings',
            new TableForeignKey({
                columnNames: ['clinicId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'clinics',
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'room_bookings',
            new TableForeignKey({
                columnNames: ['patientId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'patients',
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'room_bookings',
            new TableForeignKey({
                columnNames: ['roomId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'rooms',
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'room_bookings',
            new TableForeignKey({
                columnNames: ['packageId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'treatment_packages',
                onDelete: 'SET NULL',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('room_bookings');
    }
}
