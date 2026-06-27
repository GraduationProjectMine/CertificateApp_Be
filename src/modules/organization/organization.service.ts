import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organization_name: string, contact_email: string) {
    return this.prisma.issuingOrganization.create({
      data: { organization_name, contact_email, is_verified: false },
    });
  }

  async findById(id: string) {
    return this.prisma.issuingOrganization.findUnique({ where: { organization_id: id } });
  }

  async findByEmail(email: string) {
    return this.prisma.issuingOrganization.findUnique({ where: { contact_email: email } });
  }
}