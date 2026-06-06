import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PromotionEvent } from './promotion-event.entity';

export enum PromotionPlacement {
  POPUP = 'POPUP',
  BANNER = 'BANNER',
  BOTH = 'BOTH',
}

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  // Phase 19 — multiple images for a carousel (array of URLs). imageUrl is the
  // first-image fallback for older clients.
  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  @Column({ type: 'varchar', length: 50 })
  placement: PromotionPlacement;

  @Column({ type: 'jsonb', name: 'targeting_criteria', nullable: true })
  targetingCriteria: any;

  @Column({ default: 0 })
  priority: number;

  @Column({ name: 'starts_at', default: () => 'CURRENT_TIMESTAMP' })
  startsAt: Date;

  @Column({ name: 'ends_at', nullable: true })
  endsAt: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @OneToMany(() => PromotionEvent, (event) => event.promotion)
  events: PromotionEvent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
