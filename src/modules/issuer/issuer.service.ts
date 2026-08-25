import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class IssuerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

  async uploadLogo(id: string, file: any) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No logo image file uploaded');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only image files (JPG, PNG, WEBP, GIF, SVG) are allowed for organization logo.',
      );
    }

    // Limit file size to 5MB
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('Image file size exceeds the 5MB limit');
    }

    const org = await this.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const result = await this.cloudinaryService.uploadImage(
      file.buffer,
      'organization_logos',
      file.originalname,
    );

    const updatedOrg = await this.prisma.issuingOrganization.update({
      where: { organization_id: id },
      data: { logo_url: result.url },
    });

    return {
      message: 'Organization logo uploaded successfully',
      logo_url: updatedOrg.logo_url,
      organization: updatedOrg,
    };
  }

  //  changes the account status to unverified (is_verified = false) 
  async delete(id: string) {
    const org = await this.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const updatedOrg = await this.prisma.issuingOrganization.update({
      where: { organization_id: id },
      data: { is_verified: false },
    });

    return { 
      message: 'Organization status updated to unverified/inactive (soft deleted)', 
      organization: updatedOrg 
    };
  }
}
