import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateCertificateDto,
  UpdateCertificateDto,
} from './dto/certificate.dto';

import { IpfsService } from '../ipfs/ipfs.service';
import { BlockchainService } from '../../core/blockchain/blockchain.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ipfsService: IpfsService,
    private readonly blockchainService: BlockchainService,
    private readonly auditService: AuditService,
  ) {}

  private toIpfsPayload(certificate: any) {
    return {
      documentTitle: certificate.certificate_title,
      fullName: certificate.student_fullName,
      dob: certificate.dob ?? '',
      placeOfBirth: certificate.placeOfBirth ?? '',
      gender: certificate.gender ?? '',
      ethnicity: certificate.ethnicity ?? '',
      schoolName: certificate.schoolName ?? '',
      examCohort: certificate.examCohort ?? '',
      examBoard: certificate.examBoard ?? '',
      issueLocation: certificate.issueLocation ?? '',
      issueDate: certificate.issueDate ?? '',
      serialNumber: certificate.serialNumber ?? '',
      registryNumber: certificate.registryNumber ?? '',
    };
  }

  /**
   * Create a new certificate draft
   */
  async createDraft(
    organizationId: string,
    dto: CreateCertificateDto,
    actor?: { id: string; name?: string },
  ) {
    const requiredFields: Array<{
      field: keyof CreateCertificateDto;
      name: string;
    }> = [
      { field: 'student_id', name: 'student_id' },
      { field: 'certificate_title', name: 'certificate_title' },
      { field: 'dob', name: 'dob' },
      { field: 'placeOfBirth', name: 'placeOfBirth' },
      { field: 'gender', name: 'gender' },
      { field: 'ethnicity', name: 'ethnicity' },
      { field: 'schoolName', name: 'schoolName' },
      { field: 'examCohort', name: 'examCohort' },
      { field: 'examBoard', name: 'examBoard' },
      { field: 'issueLocation', name: 'issueLocation' },
      { field: 'issueDate', name: 'issueDate' },
      { field: 'serialNumber', name: 'serialNumber' },
      { field: 'registryNumber', name: 'registryNumber' },
    ];

    const missing = requiredFields.filter((item) => {
      const val = dto[item.field];
      return typeof val !== 'string' || !val.trim();
    });

    if (missing.length > 0) {
      throw new BadRequestException(
        `All certificate fields must have information to create a draft. Missing fields: ${missing.map((m) => m.name).join(', ')}`,
      );
    }

    // Fetch organization to get the official organization name
    const organization = await this.prisma.issuingOrganization.findUnique({
      where: { organization_id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Issuing organization not found');
    }

    // Fetch student to get student name and verify they belong to this organization
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: dto.student_id },
    });
    if (!student) {
      throw new NotFoundException('Student account not found');
    }

    if (student.organization_id !== organizationId) {
      throw new ForbiddenException(
        'Student does not belong to your organization',
      );
    }

    //  Validate template if provided
    if (dto.template_id) {
      const template = await this.prisma.certificateTemplate.findUnique({
        where: { id: dto.template_id },
      });
      if (!template) {
        throw new NotFoundException('Certificate template not found');
      }
      if (template.organization_id !== organizationId) {
        throw new ForbiddenException(
          'Template does not belong to your organization',
        );
      }
    }

    //  Store original image file to IPFS upon creation if base64 data URL is present
    let ipfsCid = dto.ipfs_cid;
    let fileUrl = dto.file_url;
    if (!ipfsCid && fileUrl && fileUrl.startsWith('data:')) {
      try {
        const matches = fileUrl.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const ipfsRes = await this.ipfsService.storeFileToIpfs(
            buffer,
            `diploma_${dto.student_id || Date.now()}`,
            mimeType,
          );
          ipfsCid = ipfsRes.cid;
          fileUrl = ipfsRes.ipfsUrl;
        }
      } catch {
        // Optional IPFS fallback
      }
    }

    if (!ipfsCid) {
      ipfsCid = `bafk_pending_${Date.now()}`;
      fileUrl =
        fileUrl && !fileUrl.startsWith('data:')
          ? fileUrl
          : `https://gateway.pinata.cloud/ipfs/${ipfsCid}`;
    }

    // Create certificate record
    const created = await this.prisma.certificate.create({
      data: {
        organization_id: organizationId,
        student_id: dto.student_id,
        template_id: dto.template_id,
        certificate_title: dto.certificate_title,
        organization_name: organization.organization_name,
        student_fullName: student.student_fullName,
        dob: dto.dob,
        placeOfBirth: dto.placeOfBirth,
        gender: dto.gender,
        ethnicity: dto.ethnicity,
        schoolName: dto.schoolName,
        examCohort: dto.examCohort,
        examBoard: dto.examBoard,
        issueLocation: dto.issueLocation,
        issueDate: dto.issueDate,
        serialNumber: dto.serialNumber,
        registryNumber: dto.registryNumber,
        ipfs_cid: ipfsCid,
        file_url: fileUrl,
        status: 'DRAFT',
      },
    });
    if (actor) {
      await this.auditService.log({
        organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: 'CREATE_CERTIFICATE',
        targetType: 'CERTIFICATE',
        targetId: created.certificate_id,
        success: true,
      });
    }
    return created;
  }

  /**
   * Find all certificates with filters
   */
  async findAll(filters: {
    organization_id?: string;
    student_id?: string;
    status?: string;
  }) {
    return this.prisma.certificate.findMany({
      where: {
        ...(filters.organization_id && {
          organization_id: filters.organization_id,
        }),
        ...(filters.student_id && { student_id: filters.student_id }),
        ...(filters.status && { status: filters.status }),
      },
      orderBy: {
        issuedAt: 'desc',
      },
    });
  }

  /**
   * Find a single certificate
   */
  async findOne(id: string, organizationId?: string) {
    let certificate: any = await this.prisma.certificate.findUnique({
      where: { certificate_id: id },
    });

    if (!certificate) {
      const onlineCert = await this.prisma.onlineCertificate.findUnique({
        where: { certificate_id: id },
      });
      if (onlineCert) {
        certificate = {
          certificate_id: onlineCert.certificate_id,
          organization_id: onlineCert.organization_id,
          student_id: onlineCert.student_id,
          certificate_title: onlineCert.certificate_title,
          student_fullName: onlineCert.student_fullName,
          dob: onlineCert.dob || null,
          placeOfBirth: onlineCert.placeOfBirth || null,
          gender: onlineCert.gender || null,
          ethnicity: onlineCert.ethnicity || null,
          schoolName: onlineCert.schoolName || null,
          examCohort: onlineCert.examCohort || null,
          examBoard: onlineCert.examBoard || null,
          issueLocation: onlineCert.issueLocation || null,
          issueDate: onlineCert.issueDate || null,
          serialNumber: onlineCert.serialNumber || null,
          registryNumber: onlineCert.registryNumber || null,
          ipfs_cid: onlineCert.ipfs_cid || null,
          file_url: onlineCert.file_url || null,
          tx_hash: onlineCert.tx_hash || null,
          block_number: onlineCert.block_number || null,
          gas_used: onlineCert.gas_used || null,
          status: onlineCert.status,
          issuedAt: onlineCert.issuedAt,
          revokedAt: onlineCert.revokedAt,
          revokedById: onlineCert.revokedById,
          revokeReason: onlineCert.revokeReason,
          revoke_tx_hash: onlineCert.revoke_tx_hash,
          revoke_block_number: onlineCert.revoke_block_number,
        };
      }
    }

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    if (organizationId && certificate.organization_id !== organizationId) {
      throw new ForbiddenException(
        'You do not have access to this certificate',
      );
    }

    return certificate;
  }

  /**
   * Update the status of a certificate draft or pending certificate
   */
  async update(id: string, organizationId: string, dto: UpdateCertificateDto) {
    //  Fetch certificate and check ownership
    const certificate = await this.findOne(id, organizationId);

    if (certificate.status === 'ISSUED') {
      throw new BadRequestException(
        'Cannot modify an already ISSUED certificate.',
      );
    }

    //  We only allow transitioning status to DRAFT or PENDING
    if (dto.status !== 'DRAFT' && dto.status !== 'PENDING') {
      throw new BadRequestException(
        'Invalid status. Staff can only transition status to DRAFT or PENDING.',
      );
    }

    //  Update status
    return this.prisma.certificate.update({
      where: { certificate_id: id },
      data: {
        status: dto.status,
      },
    });
  }

  async approve(
    id: string,
    organizationId: string,
    actor?: { id: string; name?: string },
  ) {
    const certificate = await this.findOne(id, organizationId);

    if (certificate.status === 'ISSUED') {
      throw new BadRequestException('Certificate has already been issued.');
    }

    if (certificate.status !== 'PENDING') {
      throw new BadRequestException(
        'Only certificates with status PENDING can be approved. Please submit the draft to PENDING first.',
      );
    }

    const requiredFields: Array<keyof typeof certificate> = [
      'certificate_title',
      'student_fullName',
      'dob',
      'placeOfBirth',
      'gender',
      'ethnicity',
      'schoolName',
      'examCohort',
      'examBoard',
      'issueLocation',
      'issueDate',
      'serialNumber',
      'registryNumber',
    ];

    const missingFields = requiredFields.filter((field) => !certificate[field]);
    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Cannot approve certificate: the following required fields are missing: ${missingFields.join(', ')}`,
      );
    }

    //  Construct IPFS payload
    const ipfsPayload = this.toIpfsPayload(certificate);

    let cid: string = certificate.ipfs_cid || '';
    if (
      (!cid || cid.startsWith('bafk_')) &&
      certificate.file_url &&
      certificate.file_url.startsWith('data:')
    ) {
      try {
        const matches = certificate.file_url.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const ipfsRes = await this.ipfsService.storeFileToIpfs(
            buffer,
            `diploma_${certificate.student_id || Date.now()}`,
            mimeType,
          );
          cid = ipfsRes.cid;
          await this.prisma.certificate.update({
            where: { certificate_id: id },
            data: { ipfs_cid: cid, file_url: ipfsRes.ipfsUrl },
          });
        }
      } catch {
        // Optional IPFS fallback
      }
    }

    // Binary file is pinned to IPFS, compute SHA-3 hash for on-chain registration
    const sha3Hash = this.ipfsService.calculateSha3Hash(ipfsPayload);

    let transactionHash: string | null = null;
    let blockNumber: number | null = null;
    let gasUsed: string | null = null;

    //  Register on blockchain
    if (this.blockchainService.isInitialized()) {
      try {
        const signature = await this.blockchainService.signHash(sha3Hash);
        const onChainResult = await this.blockchainService.registerCertificate(
          sha3Hash,
          cid,
          signature,
        );
        transactionHash = onChainResult.transactionHash;
        blockNumber = onChainResult.blockNumber;
        gasUsed = onChainResult.gasUsed;
      } catch (error) {
        throw new BadRequestException(
          `Failed to register certificate on-chain: ${error.message}`,
        );
      }
    } else {
      throw new BadRequestException(
        'Blockchain service is not initialized. Please verify your environment variables (.env).',
      );
    }

    //  Update the certificate status, cid, file_url, and transaction hash
    const fileUrl =
      certificate.file_url ||
      (cid ? `https://gateway.pinata.cloud/ipfs/${cid}` : null);

    const issued = await this.prisma.certificate.update({
      where: { certificate_id: id },
      data: {
        status: 'ISSUED',
        ipfs_cid: cid,
        file_url: fileUrl,
        tx_hash: transactionHash,
        block_number: blockNumber,
        gas_used: gasUsed,
        issuedAt: new Date(),
      },
    });
    if (actor) {
      await this.auditService.log({
        organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: 'ISSUE_CERTIFICATE',
        targetType: 'CERTIFICATE',
        targetId: id,
        success: true,
        details: { transactionHash, blockNumber, cid },
      });
    }
    return issued;
  }

  async batchApprove(
    ids: string[],
    organizationId: string,
    actor: { id: string; name: string },
  ) {
    const results: {
      certificateId: string;
      status: 'SUCCESS' | 'FAILED';
      error?: string;
    }[] = [];

    for (const id of ids) {
      try {
        const cert = await this.prisma.certificate.findFirst({
          where: { certificate_id: id, organization_id: organizationId },
        });
        if (!cert) {
          results.push({
            certificateId: id,
            status: 'FAILED',
            error: 'Certificate not found',
          });
          continue;
        }
        if (cert.status !== 'PENDING') {
          results.push({
            certificateId: id,
            status: 'FAILED',
            error: `Invalid status: ${cert.status}. Only PENDING can be approved.`,
          });
          continue;
        }
        await this.approve(id, organizationId, {
          id: actor.id,
          name: actor.name,
        });
        results.push({ certificateId: id, status: 'SUCCESS' });
      } catch (error) {
        results.push({
          certificateId: id,
          status: 'FAILED',
          error: error?.message || 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const failCount = results.filter((r) => r.status === 'FAILED').length;
    await this.auditService.log({
      organizationId,
      actorId: actor.id,
      actorName: actor.name,
      action: 'BATCH_ISSUE_CERTIFICATE',
      targetType: 'CERTIFICATE',
      targetId: ids.join(','),
      success: failCount === 0,
      details: { total: ids.length, success: successCount, failed: failCount },
    });

    return { results, successCount, failCount, total: ids.length };
  }

  async revoke(
    id: string,
    organizationId: string,
    actorId: string,
    reason: string,
    actorName?: string,
  ) {
    let certificate: any = await this.prisma.certificate.findFirst({
      where: { certificate_id: id, organization_id: organizationId },
    });
    let isOnline = false;

    if (!certificate) {
      const onlineCert = await this.prisma.onlineCertificate.findFirst({
        where: { certificate_id: id, organization_id: organizationId },
      });
      if (!onlineCert) {
        throw new NotFoundException(`Certificate with ID ${id} not found.`);
      }
      certificate = onlineCert;
      isOnline = true;
    }

    const cleanReason = reason.replace(/<[^>]*>/g, '').trim();
    if (cleanReason.length < 5 || cleanReason.length > 500) {
      throw new BadRequestException(
        'Revocation reason must contain 5 to 500 characters.',
      );
    }
    if (
      certificate.status !== 'ISSUED' &&
      certificate.status !== 'REVOKE_FAILED'
    ) {
      throw new BadRequestException(
        'Only ISSUED or failed revocation certificates can be revoked.',
      );
    }
    if (!this.blockchainService.isInitialized()) {
      throw new BadRequestException('Blockchain service is not initialized.');
    }

    if (isOnline) {
      await this.prisma.onlineCertificate.update({
        where: { certificate_id: id },
        data: {
          status: 'REVOKE_PENDING',
          revokeReason: cleanReason,
          revokedById: actorId,
        },
      });
    } else {
      await this.prisma.certificate.update({
        where: { certificate_id: id },
        data: {
          status: 'REVOKE_PENDING',
          revokeReason: cleanReason,
          revokedById: actorId,
        },
      });
    }

    try {
      const sha3Hash = isOnline
        ? this.ipfsService.calculateOnlineCertSha3Hash({
            documentTitle: certificate.certificate_title,
            fullName: certificate.student_fullName,
            serialNumber: certificate.serialNumber ?? '',
            registryNumber: certificate.registryNumber ?? '',
          })
        : this.ipfsService.calculateSha3Hash(
            this.toIpfsPayload(certificate),
          );
      const onChainResult =
        await this.blockchainService.revokeCertificate(sha3Hash);

      let revoked;
      if (isOnline) {
        revoked = await this.prisma.onlineCertificate.update({
          where: { certificate_id: id },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
            revokedById: actorId,
            revokeReason: cleanReason,
            revoke_tx_hash: onChainResult.transactionHash,
            revoke_block_number: onChainResult.blockNumber,
          },
        });
      } else {
        revoked = await this.prisma.certificate.update({
          where: { certificate_id: id },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
            revokedById: actorId,
            revokeReason: cleanReason,
            revoke_tx_hash: onChainResult.transactionHash,
            revoke_block_number: onChainResult.blockNumber,
          },
        });
      }

      await this.auditService.log({
        organizationId,
        actorId,
        actorName,
        action: 'REVOKE_CERTIFICATE',
        targetType: isOnline ? 'ONLINE_CERTIFICATE' : 'CERTIFICATE',
        targetId: id,
        success: true,
        details: {
          reason: cleanReason,
          transactionHash: onChainResult.transactionHash,
          blockNumber: onChainResult.blockNumber,
        },
      });
      return revoked;
    } catch (error) {
      if (isOnline) {
        await this.prisma.onlineCertificate.update({
          where: { certificate_id: id },
          data: { status: 'REVOKE_FAILED' },
        });
      } else {
        await this.prisma.certificate.update({
          where: { certificate_id: id },
          data: { status: 'REVOKE_FAILED' },
        });
      }
      await this.auditService.log({
        organizationId,
        actorId,
        actorName,
        action: 'REVOKE_CERTIFICATE',
        targetType: isOnline ? 'ONLINE_CERTIFICATE' : 'CERTIFICATE',
        targetId: id,
        success: false,
        details: { reason: cleanReason, error: error.message },
      });
      throw error;
    }
  }

  async retryRevoke(
    id: string,
    organizationId: string,
    actorId: string,
    actorName?: string,
  ) {
    const certificate = await this.findOne(id, organizationId);
    if (certificate.status !== 'REVOKE_FAILED' || !certificate.revokeReason) {
      throw new BadRequestException(
        'This certificate has no failed revocation to retry.',
      );
    }
    return this.revoke(
      id,
      organizationId,
      actorId,
      certificate.revokeReason,
      actorName,
    );
  }

  async findRevoked(organizationId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where = { organization_id: organizationId, status: 'REVOKED' };

    const [certItems, onlineItems] = await Promise.all([
      this.prisma.certificate.findMany({
        where,
        orderBy: { revokedAt: 'desc' },
      }),
      this.prisma.onlineCertificate.findMany({
        where,
        orderBy: { revokedAt: 'desc' },
      }),
    ]);

    const allRevoked = [
      ...certItems.map((c) => ({ ...c, isOnline: false })),
      ...onlineItems.map((c) => ({ ...c, isOnline: true })),
    ].sort((a, b) => {
      const timeA = a.revokedAt ? new Date(a.revokedAt).getTime() : 0;
      const timeB = b.revokedAt ? new Date(b.revokedAt).getTime() : 0;
      return timeB - timeA;
    });

    const total = allRevoked.length;
    const items = allRevoked.slice(
      (safePage - 1) * safeLimit,
      safePage * safeLimit,
    );

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Delete a certificate draft
   */
  async delete(id: string, organizationId: string) {
    const certificate = await this.findOne(id, organizationId);

    // Drafts and Pendings can be deleted, but issued certificates shouldn't be deleted via CRUD directly.
    if (certificate.status !== 'DRAFT' && certificate.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot delete a certificate that is in 'ISSUED' status.`,
      );
    }

    await this.prisma.certificate.delete({
      where: { certificate_id: id },
    });

    return { message: 'Certificate draft deleted successfully' };
  }

  /**
   * Directly issue a single certificate from Template Generator.
   * Uploads metadata JSON file to IPFS via Pinata and registers certificate on-chain.
   */
  async issueFromTemplateSingle(
    organizationId: string,
    dto: CreateCertificateDto,
    actor?: { id: string; name?: string },
  ) {
    // 1. Fetch organization
    const organization = await this.prisma.issuingOrganization.findUnique({
      where: { organization_id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Issuing organization not found');
    }

    // 2. Resolve student_id if provided (no auto-creation of StudentAccount)
    const studentId = dto.student_id?.trim() || null;
    const studentFullName = dto.student_fullName || 'Sinh viên';

    // 3. Validate template if provided
    if (dto.template_id) {
      const template = await this.prisma.certificateTemplate.findUnique({
        where: { id: dto.template_id },
      });
      if (!template) {
        throw new NotFoundException('Certificate template not found');
      }
    }

    // 4. Construct IPFS payload for Online Certificate
    const ipfsPayload = {
      documentTitle: dto.certificate_title || 'CHỨNG NHẬN / VĂN BẰNG',
      fullName: studentFullName,
      serialNumber: dto.serialNumber ?? '',
      registryNumber: dto.registryNumber ?? '',
      template_id: dto.template_id,
    };

    // 5. Store clean Online Certificate JSON payload to IPFS
    const ipfsRes = await this.ipfsService.storeOnlineCertToIpfs(ipfsPayload);
    const cid = ipfsRes.cid;
    const fileUrl = ipfsRes.ipfsUrl;
    const sha3Hash = ipfsRes.sha3Hash;

    // 6. Sign SHA-3 and register on blockchain
    let transactionHash: string | null = null;
    let blockNumber: number | null = null;
    let gasUsed: string | null = null;

    if (this.blockchainService.isInitialized()) {
      try {
        const signature = await this.blockchainService.signHash(sha3Hash);
        const onChainResult = await this.blockchainService.registerCertificate(
          sha3Hash,
          cid,
          signature,
        );
        transactionHash = onChainResult.transactionHash;
        blockNumber = onChainResult.blockNumber;
        gasUsed = onChainResult.gasUsed;
      } catch (error: any) {
        throw new BadRequestException(
          `Failed to register certificate on-chain: ${error.message}`,
        );
      }
    } else {
      throw new BadRequestException(
        'Blockchain service is not initialized. Please verify your environment variables (.env).',
      );
    }

    // 7. Create ISSUED OnlineCertificate record in online_certificates table
    const created = await this.prisma.onlineCertificate.create({
      data: {
        organization_id: organizationId,
        student_id: studentId,
        template_id: dto.template_id,
        certificate_title: dto.certificate_title || 'CHỨNG NHẬN / VĂN BẰNG',
        organization_name: organization.organization_name,
        student_fullName: studentFullName,
        dob: dto.dob,
        placeOfBirth: dto.placeOfBirth,
        gender: dto.gender,
        ethnicity: dto.ethnicity,
        schoolName: dto.schoolName,
        examCohort: dto.examCohort,
        examBoard: dto.examBoard,
        issueLocation: dto.issueLocation,
        issueDate: dto.issueDate,
        serialNumber: dto.serialNumber,
        registryNumber: dto.registryNumber,
        ipfs_cid: cid,
        file_url: fileUrl,
        tx_hash: transactionHash,
        block_number: blockNumber,
        gas_used: gasUsed,
        status: 'ISSUED',
        issuedAt: new Date(),
      },
    });

    if (actor) {
      await this.auditService.log({
        organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: 'TEMPLATE_ISSUE_ONLINE_CERTIFICATE',
        targetType: 'ONLINE_CERTIFICATE',
        targetId: created.certificate_id,
        success: true,
        details: { transactionHash, blockNumber, cid },
      });
    }

    return created;
  }

  /**
   * Find online certificates by organization or student
   */
  async findAllOnlineCertificates(query: {
    organization_id?: string;
    student_id?: string;
  }) {
    const where: any = {};
    if (query.organization_id) where.organization_id = query.organization_id;
    if (query.student_id) where.student_id = query.student_id;
    return this.prisma.onlineCertificate.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      include: {
        organization: true,
        student: true,
        template: true,
      },
    });
  }

  /**
   * Find one online certificate by ID
   */
  async findOneOnlineCertificate(id: string) {
    const cert = await this.prisma.onlineCertificate.findUnique({
      where: { certificate_id: id },
      include: {
        organization: true,
        student: true,
        template: true,
      },
    });
    if (!cert) throw new NotFoundException('Online certificate not found');
    return cert;
  }

  /**
   * Batch issue certificates directly from Template Generator.
   */
  async issueFromTemplateBatch(
    organizationId: string,
    rows: CreateCertificateDto[],
    actor: { id: string; name: string },
    template_id?: string,
  ) {
    const results: Array<{
      index: number;
      student_fullName: string;
      certificate_id?: string;
      status: 'SUCCESS' | 'FAILED';
      cid?: string;
      file_url?: string;
      tx_hash?: string;
      error?: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = { ...rows[i] };
      if (template_id) row.template_id = template_id;
      try {
        const cert = await this.issueFromTemplateSingle(
          organizationId,
          row,
          actor,
        );
        results.push({
          index: i + 1,
          student_fullName: cert.student_fullName,
          certificate_id: cert.certificate_id,
          status: 'SUCCESS',
          cid: cert.ipfs_cid || undefined,
          file_url: cert.file_url || undefined,
          tx_hash: cert.tx_hash || undefined,
        });
      } catch (err: any) {
        results.push({
          index: i + 1,
          student_fullName: row.student_fullName || `Bản ghi ${i + 1}`,
          status: 'FAILED',
          error: err.message || 'Cấp phát thất bại',
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'SUCCESS').length;
    const failCount = results.filter((r) => r.status === 'FAILED').length;

    if (actor) {
      await this.auditService.log({
        organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: 'TEMPLATE_BATCH_ISSUE_CERTIFICATE',
        targetType: 'CERTIFICATE_BATCH',
        targetId: `batch_${Date.now()}`,
        success: failCount === 0,
        details: { total: rows.length, successCount, failCount },
      });
    }

    return {
      total: rows.length,
      successCount,
      failCount,
      results,
    };
  }
}
