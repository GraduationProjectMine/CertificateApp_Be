import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentAccount } from '../../core/database/entities/student-account.entity';

@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(StudentAccount)
    private readonly studentRepo: Repository<StudentAccount>,
  ) {}

  async create(
    student_fullName: string,
    email: string,
    hashedPassword: string,
    organization_id: number,
    created_by?: number,
  ): Promise<Omit<StudentAccount, 'password'>> {
    const student = this.studentRepo.create({
      student_fullName,
      email,
      password: hashedPassword,
      organization_id,
      created_by,
      status: 'Active',
    });
    const saved = await this.studentRepo.save(student);
    const { password, ...result } = saved;
    return result;
  }

  async findByEmail(email: string): Promise<StudentAccount | undefined> {
    const student = await this.studentRepo.findOne({ where: { email } });
    return student ?? undefined;
  }

  async findById(id: number): Promise<Omit<StudentAccount, 'password'> | undefined> {
    const student = await this.studentRepo.findOne({ where: { student_id: id } });
    if (!student) return undefined;
    const { password, ...result } = student;
    return result;
  }
}