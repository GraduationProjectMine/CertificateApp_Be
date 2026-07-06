import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    student_fullName: string,
    email: string,
    hashedPassword: string,
    organization_id: string,
    organization_name?: string,
  ) {
    let orgName = organization_name;
    if (!orgName) {
      const org = await this.prisma.issuingOrganization.findUnique({
        where: { organization_id },
      });
      orgName = org?.organization_name ?? '';
    }

    return this.prisma.studentAccount.create({
      data: {
        student_fullName,
        email,
        password: hashedPassword,
        organization_id,
        organization_name: orgName,
        status: 'ACTIVE',
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.studentAccount.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.studentAccount.findUnique({ where: { student_id: id } });
  }
}
