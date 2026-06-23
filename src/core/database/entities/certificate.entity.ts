import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IssuingOrganization } from './issuing-organization.entity';
import { StudentAccount } from './student-account.entity';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn()
  certificate_id!: number;

  @Column({ type: 'int' })
  organization_id!: number;

  @ManyToOne(() => IssuingOrganization, (org) => org.certificates)
  @JoinColumn({ name: 'organization_id' })
  organization!: IssuingOrganization;

  @Column({ type: 'int' })
  student_id!: number;

  @ManyToOne(() => StudentAccount, (student) => student.certificates)
  @JoinColumn({ name: 'student_id' })
  student!: StudentAccount;

  @Column({ type: 'varchar', length: 255 })
  certificate_title!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ipfs_cid!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tx_hash!: string;

  @Column({ type: 'varchar', length: 50, default: 'Issued' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  issuedAt!: Date;
}