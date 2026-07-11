import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

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

  async findAll(organizationId: string) {
    return this.prisma.studentAccount.findMany({
      where: { organization_id: organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    studentId: string,
    organizationId: string,
    data: { name?: string; email?: string; status?: string; password?: string },
  ) {
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: studentId },
    });

    if (!student || student.organization_id !== organizationId) {
      throw new NotFoundException(
        'Student account not found or does not belong to your organization.',
      );
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.student_fullName = data.name;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.email !== undefined && data.email !== student.email) {
      const existing = await this.prisma.studentAccount.findFirst({
        where: {
          email: data.email,
          NOT: { student_id: studentId },
        },
      });
      if (existing) {
        throw new ConflictException('Email already exists');
      }
      updateData.email = data.email;
    }

    if (data.password !== undefined && data.password) {
      updateData.password = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    return this.prisma.studentAccount.update({
      where: { student_id: studentId },
      data: updateData,
    });
  }

  async delete(studentId: string, organizationId: string) {
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: studentId },
    });

    if (!student || student.organization_id !== organizationId) {
      throw new NotFoundException(
        'Student account not found or does not belong to your organization.',
      );
    }

    // Check if student has certificates. If they do, prevent deletion.
    const certCount = await this.prisma.certificate.count({
      where: { student_id: studentId },
    });

    if (certCount > 0) {
      throw new BadRequestException(
        'Cannot delete student because they have issued or pending certificates.',
      );
    }

    await this.prisma.studentAccount.delete({
      where: { student_id: studentId },
    });

    return { message: 'Student account deleted successfully' };
  }
}
