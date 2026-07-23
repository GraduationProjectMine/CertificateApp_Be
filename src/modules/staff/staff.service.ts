import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../core/prisma/prisma.service';

const SALT_ROUNDS = 12;

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
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.staffAccount.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.staffAccount.findUnique({ where: { staff_id: id } });
  }

  async findByOrganization(organizationId: string) {
    return this.prisma.staffAccount.findMany({
      where: { organization_id: organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOwnerByOrganization(organizationId: string) {
    return this.prisma.staffAccount.findFirst({
      where: {
        organization_id: organizationId,
        role: 'ISSUER',
      },
    });
  }

  async update(
    staffId: string,
    organizationId: string,
    data: { name?: string; email?: string; isActive?: boolean; role?: string; password?: string },
  ) {
    const staff = await this.prisma.staffAccount.findUnique({
      where: { staff_id: staffId },
    });

    if (!staff || staff.organization_id !== organizationId) {
      throw new NotFoundException('Staff member not found or does not belong to your organization');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.role !== undefined) updateData.role = data.role;

    if (data.email !== undefined && data.email !== staff.email) {
      const existing = await this.prisma.staffAccount.findFirst({
        where: { email: data.email, NOT: { staff_id: staffId } },
      });
      if (existing) throw new ConflictException('Email already exists');
      updateData.email = data.email;
    }

    if (data.password !== undefined && data.password) {
      updateData.password = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    const updated = await this.prisma.staffAccount.update({
      where: { staff_id: staffId },
      data: updateData,
    });

    const { password, ...result } = updated;
    return result;
  }

  async delete(staffId: string, organizationId: string) {
    const staff = await this.prisma.staffAccount.findUnique({
      where: { staff_id: staffId },
    });

    if (!staff || staff.organization_id !== organizationId) {
      throw new NotFoundException('Staff member not found or does not belong to your organization');
    }

    await this.prisma.staffAccount.delete({
      where: { staff_id: staffId },
    });

    return { message: 'Staff member deleted successfully' };
  }
}
