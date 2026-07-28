import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class ShareService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a shareable link for a certificate
   */
  async createShareLink(
    studentId: string,
    certificateId: string,
    options: { expiresInDays?: number; scope?: string[] },
  ) {
    // Verify the certificate belongs to the student
    const cert = await this.prisma.certificate.findUnique({
      where: { certificate_id: certificateId },
    });
    if (!cert) throw new NotFoundException('Certificate not found');
    if (cert.student_id !== studentId)
      throw new ForbiddenException('This certificate does not belong to you');
    if (cert.status !== 'ISSUED')
      throw new BadRequestException('Only ISSUED certificates can be shared');

    const shareToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = options.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const share = await this.prisma.credentialShare.create({
      data: {
        student_id: studentId,
        certificate_id: certificateId,
        share_token: shareToken,
        scope: options.scope ? JSON.stringify(options.scope) : undefined,
        expires_at: expiresAt,
      },
    });

    return {
      ...share,
      share_url: `/verify/share/${shareToken}`,
    };
  }

  /**
   * Get all active (non-revoked) shares for a student
   */
  async getActiveShares(studentId: string) {
    const shares = await this.prisma.credentialShare.findMany({
      where: { student_id: studentId, revoked: false },
      orderBy: { createdAt: 'desc' },
    });

    return shares.map((s) => ({
      ...s,
      is_expired: s.expires_at ? s.expires_at < new Date() : false,
      share_url: `/verify/share/${s.share_token}`,
    }));
  }

  /**
   * Get all shares (including revoked/expired) for a certificate
   */
  async getSharesByCert(studentId: string, certificateId: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificate_id: certificateId },
    });
    if (!cert || cert.student_id !== studentId)
      throw new ForbiddenException('Access denied');

    return this.prisma.credentialShare.findMany({
      where: { student_id: studentId, certificate_id: certificateId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke a share link
   */
  async revokeShare(shareId: string, studentId: string) {
    const share = await this.prisma.credentialShare.findUnique({
      where: { id: shareId },
    });
    if (!share) throw new NotFoundException('Share link not found');
    if (share.student_id !== studentId)
      throw new ForbiddenException('You do not own this share link');
    if (share.revoked)
      throw new BadRequestException('Share link is already revoked');

    return this.prisma.credentialShare.update({
      where: { id: shareId },
      data: { revoked: true },
    });
  }

  /**
   * Verify a share token (public endpoint) — increments verify_count
   */
  async verifyShareToken(token: string) {
    const share = await this.prisma.credentialShare.findUnique({
      where: { share_token: token },
    });

    if (!share) throw new NotFoundException('Link chia sẻ không hợp lệ');
    if (share.revoked) throw new GoneException('Link chia sẻ đã bị thu hồi');
    if (share.expires_at && share.expires_at < new Date())
      throw new GoneException('Link chia sẻ đã hết hạn');

    // Increment verify count
    await this.prisma.credentialShare.update({
      where: { id: share.id },
      data: { verify_count: { increment: 1 } },
    });

    const cert = await this.prisma.certificate.findUnique({
      where: { certificate_id: share.certificate_id },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    // Apply field-level scope filtering
    let scopedCert: any = { ...cert };
    if (share.scope) {
      const allowedFields = JSON.parse(share.scope as string) as string[];
      const fullFields = Object.keys(cert);
      const alwaysIncluded = [
        'certificate_id',
        'certificate_title',
        'student_fullName',
        'organization_name',
        'status',
        'issuedAt',
        'ipfs_cid',
        'tx_hash',
      ];
      scopedCert = Object.fromEntries(
        Object.entries(cert).filter(
          ([k]) => alwaysIncluded.includes(k) || allowedFields.includes(k),
        ),
      );
    }

    return {
      certificate: scopedCert,
      share: {
        expires_at: share.expires_at,
        verify_count: share.verify_count + 1,
      },
    };
  }
}
