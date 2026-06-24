import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IssuingOrganization } from './issuing-organization.entity';

@Entity('staff_accounts')
export class StaffAccount {
  @PrimaryGeneratedColumn()
  staff_id!: number;

  @Column({ type: 'int' })
  organization_id!: number;

  @ManyToOne(() => IssuingOrganization, (org) => org.staffAccounts)
  @JoinColumn({ name: 'organization_id' })
  organization!: IssuingOrganization;

  @Column({ type: 'int', nullable: true })
  created_by!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'varchar', length: 50, default: 'Staff' })
  role!: string;

  @Column({ type: 'varchar', length: 50, default: 'Active' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}