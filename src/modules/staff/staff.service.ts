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
    let orgName = organization_name;
    if (!orgName) {
      const org = await this.prisma.issuingOrganization.findUnique({
        where: { organization_id },
      });
      orgName = org?.organization_name ?? '';
    }

    return this.prisma.staffAccount.create({
      data: {
        name,
        email,
        password: hashedPassword,
        organization_id,
        organization_name: orgName,
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
