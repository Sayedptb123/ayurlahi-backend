import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TreatmentProtocol } from './treatment-protocol.entity';

/**
 * treatment_protocol_items — Phase 24C.3. One BOM line: the expected quantity of
 * a medicine consumed per protocol run. `product_id` optionally links to a
 * marketplace product; `item_name` covers in-house / off-catalog medicines.
 */
@Entity('treatment_protocol_items')
export class TreatmentProtocolItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'protocol_id', type: 'uuid' })
  protocolId: string;

  @ManyToOne(() => TreatmentProtocol, (p) => p.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'protocol_id' })
  protocol: TreatmentProtocol;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
