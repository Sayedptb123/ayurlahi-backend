import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type OtpPurpose = 'login' | 'password_reset';
export type OtpChannel = 'sms' | 'email';

@Index(['identifier', 'purpose', 'expiresAt'])
@Entity('otp_verifications')
export class OtpVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'identifier' })
  identifier: string; // phone number or email address

  @Column({ type: 'varchar', length: 10, name: 'channel' })
  channel: OtpChannel;

  @Column({ type: 'varchar', name: 'otp_hash' })
  otpHash: string;

  @Column({ type: 'varchar', length: 20, name: 'purpose' })
  purpose: OtpPurpose;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'used_at' })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
