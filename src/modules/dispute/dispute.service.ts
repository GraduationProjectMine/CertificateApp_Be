import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ReviewDisputeDto } from './dto/review-dispute.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DisputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Student creates a request to change certificate information.
   * STRICT REQUIREMENT: Only certificates with status DRAFT can be requested.
   */
  async createDispute(studentId: string, dto: CreateDisputeDto) {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificate_id: dto.certificate_id },
    });

    if (!cert) {
      throw new NotFoundException('Không tìm thấy văn bằng tương ứng.');
    }

    if (cert.student_id !== studentId) {
      throw new ForbiddenException('Bạn chỉ có thể gửi yêu cầu cho văn bằng của chính mình.');
    }

    // Enforce DRAFT status rule
    if (cert.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ có thể gửi yêu cầu chỉnh sửa đối với văn bằng ở trạng thái bản thảo (DRAFT). Văn bằng đã cấp chính thức hoặc đã thu hồi không thể gửi yêu cầu qua kênh này.',
      );
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        student_id: studentId,
        organization_id: cert.organization_id,
        certificate_id: cert.certificate_id,
        reason: dto.reason,
        details: dto.details,
        status: 'PENDING',
      },
      include: {
        certificate: {
          select: {
            certificate_title: true,
            student_fullName: true,
          },
        },
      },
    });

    // Send notification to student
    try {
      await this.notificationsService.create({
        student_id: studentId,
        organization_id: cert.organization_id,
        title: 'Đã gửi yêu cầu chỉnh sửa bản thảo',
        message: `Yêu cầu chỉnh sửa cho văn bằng "${cert.certificate_title}" đã được gửi tới nhà trường.`,
        type: 'INFO',
        related_id: cert.certificate_id,
      });
    } catch {}

    return dispute;
  }

  /**
   * Find disputes created by a specific student.
   */
  async findByStudent(studentId: string) {
    return this.prisma.dispute.findMany({
      where: { student_id: studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        certificate: {
          select: {
            certificate_title: true,
            student_fullName: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Find disputes belonging to an issuing organization (for Issuers and Staff).
   */
  async findByOrganization(organizationId: string, status?: string) {
    return this.prisma.dispute.findMany({
      where: {
        organization_id: organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        certificate: {
          select: {
            certificate_title: true,
            student_fullName: true,
            status: true,
          },
        },
        student: {
          select: {
            student_fullName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get single dispute details.
   */
  async findOne(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        certificate: true,
        student: {
          select: {
            student_fullName: true,
            email: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Không tìm thấy yêu cầu chỉnh sửa.');
    }

    return dispute;
  }

  /**
   * Review (Approve / Reject) a correction request.
   */
  async reviewDispute(
    id: string,
    organizationId: string,
    reviewerId: string,
    dto: ReviewDisputeDto,
  ) {
    const dispute = await this.findOne(id);

    if (dispute.organization_id !== organizationId) {
      throw new ForbiddenException('Bạn không có quyền xử lý yêu cầu của tổ chức khác.');
    }

    const updated = await this.prisma.dispute.update({
      where: { id },
      data: {
        status: dto.decision,
        reviewer_id: reviewerId,
        reviewer_note: dto.reviewer_note || null,
        resolved_at: new Date(),
      },
      include: {
        certificate: {
          select: {
            certificate_title: true,
          },
        },
      },
    });

    // Notify student about review decision
    try {
      const decisionText = dto.decision === 'APPROVED' ? 'chấp thuận' : 'từ chối';
      await this.notificationsService.create({
        student_id: dispute.student_id,
        organization_id: dispute.organization_id,
        title: `Yêu cầu chỉnh sửa đã được ${decisionText}`,
        message: `Yêu cầu chỉnh sửa văn bằng "${dispute.certificate.certificate_title}" đã được nhà trường ${decisionText}.${dto.reviewer_note ? ` Phản hồi: ${dto.reviewer_note}` : ''}`,
        type: 'INFO',
        related_id: dispute.certificate_id,
      });
    } catch {}

    return updated;
  }
}
