import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { StaffAccount } from './staff-account.entity';
import { Certificate } from './certificate.entity';

@Entity('issuing_organizations')
export class IssuingOrganization {
  @PrimaryGeneratedColumn()
  organization_id!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  wallet_address!: string;

  @Column({ type: 'varchar', length: 255 })
  organization_name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  contact_email!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url!: string;

  @Column({ type: 'boolean', default: false })
  is_verified!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @OneToMany(() => StaffAccount, (staff) => staff.organization)
  staffAccounts!: StaffAccount[];

  @OneToMany(() => Certificate, (cert) => cert.organization)
  certificates!: Certificate[];
}