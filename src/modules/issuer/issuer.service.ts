import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class IssuerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organization_name: string, contact_email: string, wallet_address?: string) {
    return this.prisma.issuingOrganization.create({
      data: {
        organization_name,
        contact_email,
        wallet_address: wallet_address ? wallet_address.toLowerCase() : null,
        is_verified: false,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.issuingOrganization.findUnique({
      where: { organization_id: id },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.issuingOrganization.findUnique({
      where: { contact_email: email },
    });
  }

  async findByWalletAddress(walletAddress: string) {
    return this.prisma.issuingOrganization.findFirst({
      where: { wallet_address: walletAddress.toLowerCase() },
    });
  }

  async findAll() {
    return this.prisma.issuingOrganization.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  async update(
    id: string,
    data: {
      organization_name?: string;
      contact_email?: string;
      logo_url?: string;
      is_verified?: boolean;
      wallet_address?: string;
    },
  ) {
    const org = await this.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.issuingOrganization.update({
      where: { organization_id: id },
      data,
    });
  }

  async delete(id: string) {
    const org = await this.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    await this.prisma.issuingOrganization.delete({
      where: { organization_id: id },
    });

    return { message: 'Organization deleted successfully' };
  }
}
