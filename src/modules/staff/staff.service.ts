import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    name: string,
    email: string,
    hashedPassword: string,
    organization_id: string,
    organization_name?: string,
    role: string = 'STAFF',
  ) {
    return this.prisma.staffAccount.create({
      data: {
        name,
        email,
        password: hashedPassword,
        organization_id,
        organization_name: organization_name ?? '',
        role,
        status: 'ACTIVE',
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.staffAccount.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.staffAccount.findUnique({ where: { staff_id: id } });
  }
}
