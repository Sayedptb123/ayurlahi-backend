import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { User } from '../../users/entities/user.entity';

export enum EnquiryChannel {
    PHONE = 'PHONE',
    WALK_IN = 'WALK_IN',
    WHATSAPP = 'WHATSAPP',
    WEBSITE = 'WEBSITE',
}

export enum EnquiryStatus {
    NEW = 'NEW',
    FOLLOW_UP = 'FOLLOW_UP',
    LOST = 'LOST',
}

@Entity('booking_enquiries')
export class BookingEnquiry {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'organisation_id' })
    organisationId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'organisation_id' })
    organisation: Organisation;

    @Column({ type: 'varchar', length: 255, name: 'contact_name' })
    contactName: string;

    @Column({ type: 'varchar', length: 50, name: 'phone' })
    phone: string;

    @Column({
        type: 'enum',
        enum: EnquiryChannel,
        name: 'channel',
    })
    channel: EnquiryChannel;

    @Column({ type: 'varchar', length: 50, nullable: true, name: 'preferred_room_type' })
    preferredRoomType: string | null;

    @Column({ type: 'date', nullable: true, name: 'preferred_check_in' })
    preferredCheckIn: Date | null;

    @Column({ type: 'date', nullable: true, name: 'preferred_check_out' })
    preferredCheckOut: Date | null;

    @Column({ type: 'date', nullable: true, name: 'expected_delivery_date' })
    expectedDeliveryDate: Date | null;

    @Column({
        type: 'enum',
        enum: EnquiryStatus,
        default: EnquiryStatus.NEW,
        name: 'status',
    })
    status: EnquiryStatus;

    @Column({ type: 'text', nullable: true, name: 'notes' })
    notes: string | null;

    @Column({ type: 'uuid', nullable: true, name: 'assigned_to' })
    assignedTo: string | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'assigned_to' })
    assignedToUser: User | null;

    @Column({ type: 'timestamp', nullable: true, name: 'follow_up_at' })
    followUpAt: Date | null;

    @Column({ type: 'text', nullable: true, name: 'lost_reason' })
    lostReason: string | null;

    @Column({ type: 'jsonb', nullable: true, name: 'additional_info' })
    additionalInfo: Record<string, any> | null;

    @DeleteDateColumn({ type: 'timestamp', nullable: true, name: 'deleted_at' })
    deletedAt: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
