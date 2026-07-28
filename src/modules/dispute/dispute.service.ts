import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../../core/mail/mail.service';

@Injectable()
export class DisputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Student submits a correction/dispute request
   */
  async createDispute(
    studentId: string,
    certificateId: string,
    reason: string,
    details?: string,
  ) {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificate_id: certificateId },
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    if (cert.student_id !== studentId)
      throw new ForbiddenException('This certificate does not belong to you');
    if (!['ISSUED', 'DRAFT'].includes(cert.status))
      throw new BadRequestException(
        'Only ISSUED or DRAFT certificates can have a dispute filed',
      );

    // Check if there's already a pending dispute for this cert
    const existing = await this.prisma.disputeRequest.findFirst({
      where: { student_id: studentId, certificate_id: certificateId, status: 'PENDING' },
    });
    if (existing)
      throw new BadRequestException(
        'Bạn đã có một yêu cầu chỉnh sửa đang chờ xử lý cho bằng cấp này',
      );

    return this.prisma.disputeRequest.create({
      data: {
        student_id: studentId,
        certificate_id: certificateId,
        reason,
        details,
      },
    });
  }

  /**
   * Get all disputes submitted by a student
   */
  async getStudentDisputes(studentId: string) {
    return this.prisma.disputeRequest.findMany({
      where: { student_id: studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get dispute by ID (student must own it)
   */
  async getDisputeById(disputeId: string, studentId: string) {
    const dispute = await this.prisma.disputeRequest.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.student_id !== studentId)
      throw new ForbiddenException('Access denied');
    return dispute;
  }

  /**
   * Get all disputes for an organization (issuer view)
   */
  async getOrgDisputes(organizationId: string, status?: string) {
    const certs = await this.prisma.certificate.findMany({
      where: { organization_id: organizationId },
      select: { certificate_id: true },
    });
    const certIds = certs.map((c) => c.certificate_id);

    return this.prisma.disputeRequest.findMany({
      where: {
        certificate_id: { in: certIds },
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Issuer reviews a dispute: APPROVE or REJECT
   */
  async reviewDispute(
    disputeId: string,
    organizationId: string,
    reviewerId: string,
    reviewerName: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewerNote?: string,
    newCertData?: Record<string, any>,
  ) {
    const dispute = await this.prisma.disputeRequest.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.status !== 'PENDING')
      throw new BadRequestException('Dispute is already resolved');

    const origCert = await this.prisma.certificate.findUnique({
      where: { certificate_id: dispute.certificate_id },
    });
    if (!origCert) throw new NotFoundException('Original certificate not found');
    if (origCert.organization_id !== organizationId)
      throw new ForbiddenException('This certificate does not belong to your organization');

    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: dispute.student_id },
    });

    let newCertId: string | null = null;

    if (decision === 'APPROVED') {
      // Create new certificate version with corrected data
      const mergedData = {
        organization_id: origCert.organization_id,
        student_id: origCert.student_id,
        template_id: origCert.template_id,
        certificate_title: origCert.certificate_title,
        organization_name: origCert.organization_name,
        student_fullName: origCert.student_fullName,
        dob: origCert.dob,
        placeOfBirth: origCert.placeOfBirth,
        gender: origCert.gender,
        ethnicity: origCert.ethnicity,
        schoolName: origCert.schoolName,
        examCohort: origCert.examCohort,
        examBoard: origCert.examBoard,
        issueLocation: origCert.issueLocation,
        issueDate: origCert.issueDate,
        serialNumber: origCert.serialNumber,
        registryNumber: origCert.registryNumber,
        ipfs_cid: origCert.ipfs_cid,
        file_url: origCert.file_url,
        status: 'DRAFT',
        version: (origCert.version ?? 1) + 1,
        ...(newCertData ?? {}),
      };

      const newCert = await this.prisma.certificate.create({ data: mergedData });
      newCertId = newCert.certificate_id;

      // Mark original as SUPERSEDED
      await this.prisma.certificate.update({
        where: { certificate_id: origCert.certificate_id },
        data: { status: 'SUPERSEDED', superseded_by: newCertId },
      });
    }

    // Update dispute status
    await this.prisma.disputeRequest.update({
      where: { id: disputeId },
      data: {
        status: decision,
        reviewer_id: reviewerId,
        reviewer_note: reviewerNote,
        resolved_at: new Date(),
        new_cert_id: newCertId,
      },
    });

    // Send in-app notification
    if (student) {
      await this.notificationsService.createEvent({
        student_id: dispute.student_id,
        organization_id: organizationId,
        title: decision === 'APPROVED'
          ? '✅ Yêu cầu chỉnh sửa được chấp thuận'
          : '❌ Yêu cầu chỉnh sửa bị từ chối',
        message: decision === 'APPROVED'
          ? `Yêu cầu chỉnh sửa bằng cấp "${origCert.certificate_title}" của bạn đã được chấp thuận. Bằng cấp mới sẽ sớm được phát hành.`
          : `Yêu cầu chỉnh sửa bằng cấp "${origCert.certificate_title}" của bạn đã bị từ chối.${reviewerNote ? ` Lý do: ${reviewerNote}` : ''}`,
        type: 'DISPUTE_RESULT',
        event_type: decision === 'APPROVED' ? 'DISPUTE_APPROVED' : 'DISPUTE_REJECTED',
        related_id: dispute.certificate_id,
        deep_link: `/student/certificates`,
      });

      // Send email notification
      await this.mailService.sendDisputeResultEmail(
        student.email,
        student.student_fullName,
        origCert.certificate_title,
        decision,
        reviewerNote,
      );
    }

    return {
      message: `Dispute ${decision === 'APPROVED' ? 'approved' : 'rejected'} successfully`,
      new_certificate_id: newCertId,
    };
  }
}
