import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { IssuingOrganization } from './issuing-organization.entity';
import { Certificate } from './certificate.entity';

@Entity('student_accounts')
export class StudentAccount {
  @PrimaryGeneratedColumn()
  student_id!: number;

  @Column({ type: 'int' })
  organization_id!: number;

  @ManyToOne(() => IssuingOrganization, (org) => org.staffAccounts)
  @JoinColumn({ name: 'organization_id' })
  organization!: IssuingOrganization;

  @Column({ type: 'varchar', length: 255 })
  student_fullName!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'varchar', length: 50, default: 'Active' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @OneToMany(() => Certificate, (cert) => cert.student)
  certificates!: Certificate[];
}