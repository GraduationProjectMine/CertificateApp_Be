import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';

@Injectable()
export class CertificateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCertificateDto, userId: string, orgId: string) {
    // Lấy thông tin student để lấy tên
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: dto.student_id },
      include: { organization: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (student.organization_id !== orgId) throw new ForbiddenException('Student does not belong to your organization');

    return this.prisma.certificate.create({
      data: {
        organization_id: orgId,
        organization_name: student.organization.organization_name,
        student_id: dto.student_id,
        student_fullName: student.student_fullName,
        certificate_title: dto.certificate_title,
        issue_date: dto.issue_date ? new Date(dto.issue_date) : null,
        expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : null,
        metadata: dto.metadata,
        template_id: dto.template_id,
        status: 'DRAFT',
        created_by: userId,
      },
    });
  }

  async findAll(orgId: string, status?: string) {
    const where: any = { organization_id: orgId };
    if (status) where.status = status;
    return this.prisma.certificate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, orgId: string) {
    const cert = await this.prisma.certificate.findUnique({ where: { certificate_id: id } });
    if (!cert) throw new NotFoundException('Certificate not found');
    if (cert.organization_id !== orgId) throw new ForbiddenException('Access denied');
    return cert;
  }

  async update(id: string, dto: UpdateCertificateDto, userId: string, orgId: string) {
    const cert = await this.findOne(id, orgId);

    const data: any = {};
    if (dto.certificate_title !== undefined) data.certificate_title = dto.certificate_title;
    if (dto.issue_date !== undefined) data.issue_date = new Date(dto.issue_date);
    if (dto.expiry_date !== undefined) data.expiry_date = new Date(dto.expiry_date);
    if (dto.metadata !== undefined) data.metadata = dto.metadata;
    if (dto.template_id !== undefined) data.template_id = dto.template_id;
    if (dto.rejected_reason !== undefined) data.rejected_reason = dto.rejected_reason;
    if (dto.status !== undefined) {
      this.validateStatusTransition(cert.status, dto.status);
      data.status = dto.status;
      if (dto.status === 'APPROVED') {
        data.approved_by = userId;
        data.approved_at = new Date();
      }
    }
    data.updated_by = userId;

    return this.prisma.certificate.update({ where: { certificate_id: id }, data });
  }

  async remove(id: string, orgId: string) {
    const cert = await this.findOne(id, orgId);
    if (cert.status !== 'DRAFT') throw new ForbiddenException('Only DRAFT certificates can be deleted');
    await this.prisma.certificate.delete({ where: { certificate_id: id } });
    return { message: 'Certificate deleted successfully' };
  }

  private validateStatusTransition(current: string, next: string) {
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['APPROVED'],
      APPROVED: ['DRAFT', 'IPFS_UPLOADED'],
      IPFS_UPLOADED: ['APPROVED', 'BLOCKCHAIN_NOTARIZED'],
      BLOCKCHAIN_NOTARIZED: ['IPFS_UPLOADED'],
    };
    const allowed = validTransitions[current];
    if (!allowed || !allowed.includes(next)) {
      throw new ForbiddenException(
        `Cannot transition from ${current} to ${next}. Allowed: ${(allowed || []).join(', ') || 'none'}`,
      );
    }
  }
}