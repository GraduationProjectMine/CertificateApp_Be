import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateTemplateDto) {
    const organization = await this.prisma.issuingOrganization.findUnique({
      where: { organization_id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Issuing organization not found');
    }

    if (dto.is_default) {
      await this.prisma.certificateTemplate.updateMany({
        where: { organization_id: organizationId, is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.certificateTemplate.create({
      data: {
        organization_id: organizationId,
        name: dto.name,
        description: dto.description,
        design_data: dto.design_data as any,
        thumbnail_url: dto.thumbnail_url,
        is_default: dto.is_default ?? false,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.certificateTemplate.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, organizationId?: string) {
    const template = await this.prisma.certificateTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (organizationId && template.organization_id !== organizationId) {
      throw new ForbiddenException('You do not have access to this template');
    }

    return template;
  }

  async update(id: string, organizationId: string, dto: UpdateTemplateDto) {
    await this.findOne(id, organizationId);

    if (dto.is_default) {
      await this.prisma.certificateTemplate.updateMany({
        where: { organization_id: organizationId, is_default: true, id: { not: id } },
        data: { is_default: false },
      });
    }

    return this.prisma.certificateTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.design_data !== undefined && { design_data: dto.design_data as any }),
        ...(dto.thumbnail_url !== undefined && { thumbnail_url: dto.thumbnail_url }),
        ...(dto.is_default !== undefined && { is_default: dto.is_default }),
      },
    });
  }

  async delete(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    await this.prisma.certificateTemplate.delete({ where: { id } });

    return { message: 'Template deleted successfully' };
  }

  async getDefault(organizationId: string) {
    return this.prisma.certificateTemplate.findFirst({
      where: { organization_id: organizationId, is_default: true },
    });
  }

  async duplicate(id: string, organizationId: string) {
    const original = await this.findOne(id, organizationId);

    return this.prisma.certificateTemplate.create({
      data: {
        organization_id: organizationId,
        name: `${original.name} (Sao chép)`,
        description: original.description,
        design_data: original.design_data as any,
        thumbnail_url: original.thumbnail_url,
        is_default: false,
      },
    });
  }
}
