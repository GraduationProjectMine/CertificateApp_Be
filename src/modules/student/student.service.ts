import { Injectable } from '@nestjs/common';

export interface Student {
  id: number;
  email: string;
  username: string;
  password: string;
  role: 'student';
  createdAt: Date;
}

@Injectable()
export class StudentService {
  private students: Student[] = [];
  private nextId = 1;

  async create(email: string, username: string, hashedPassword: string): Promise<Omit<Student, 'password'>> {
    const student: Student = {
      id: this.nextId++,
      email,
      username,
      password: hashedPassword,
      role: 'student',
      createdAt: new Date(),
    };
    this.students.push(student);
    const { password, ...result } = student;
    return result;
  }

  async findByEmail(email: string): Promise<Student | undefined> {
    return this.students.find((u) => u.email === email);
  }

  async findById(id: number): Promise<Omit<Student, 'password'> | undefined> {
    const student = this.students.find((u) => u.id === id);
    if (!student) return undefined;
    const { password, ...result } = student;
    return result;
  }
}