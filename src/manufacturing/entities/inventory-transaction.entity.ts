import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { RawMaterial } from './raw-material.entity';
import { Organisation } from '../../organisations/entities/organisation.entity';

export enum TransactionType {
    PURCHASE = 'PURCHASE',       // Buying from supplier
    PRODUCTION_USAGE = 'USAGE',  // Used in a batch
    PRODUCTION_OUTPUT = 'OUTPUT',// Created from a batch (e.g. Cleaned Material)
    RETURN_IN = 'RETURN_IN',     // Returned from clinic
    RETURN_OUT = 'RETURN_OUT',   // Returned to supplier
    ADJUSTMENT = 'ADJUSTMENT',   // Stock correction
    EXPIRED = 'EXPIRED',         // Written off
}

@Entity('inventory_transactions')
export class InventoryTransaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'manufacturer_id' })
    manufacturerId: string;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'manufacturer_id' })
    manufacturer: Organisation;

    @Column({ type: 'uuid', name: 'raw_material_id', nullable: true })
    rawMaterialId: string | null;

    @ManyToOne(() => RawMaterial)
    @JoinColumn({ name: 'raw_material_id' })
    rawMaterial: RawMaterial | null;

    // We will link to Product (Finished Good) later or use a generic ID
    @Column({ type: 'uuid', name: 'product_id', nullable: true })
    productId: string | null;

    @Column({ type: 'varchar', length: 50 })
    transactionType: TransactionType;

    @Column({ type: 'decimal', precision: 10, scale: 3 })
    quantity: number; // Positive for IN, Negative for OUT (or handle logic in service)

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'unit_cost' })
    unitCost: number | null; // Cost at the time of transaction (for FIFO/Moving Average)

    @Column({ type: 'uuid', nullable: true, name: 'batch_id' })
    batchId: string | null; // Linked to a production batch if applicable

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @CreateDateColumn({ name: 'transaction_date' })
    transactionDate: Date;

    @Column({ type: 'uuid', nullable: true, name: 'performed_by' })
    performedBy: string | null; // User ID
}
