import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea';

@Entity('booking_field_definitions')
export class BookingFieldDefinition {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @Column({ type: 'varchar', length: 100 })
    label: string;

    @Column({ type: 'varchar', length: 50, name: 'field_key' })
    fieldKey: string;

    @Column({ type: 'varchar', length: 20, name: 'field_type', default: 'text' })
    fieldType: FieldType;

    @Column({ type: 'boolean', default: false })
    required: boolean;

    @Column({ type: 'jsonb', nullable: true, name: 'options_json' })
    optionsJson: string[] | null;

    @Column({ type: 'int', name: 'display_order', default: 0 })
    displayOrder: number;

    @Column({ type: 'boolean', name: 'is_active', default: true })
    isActive: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
