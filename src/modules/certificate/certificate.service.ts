import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateCertificateDto, UpdateCertificateDto } from './dto/certificate.dto';
import { IpfsService } from '../ipfs/ipfs.service';
import { BlockchainService } from '../../core/blockchain/blockchain.service';

@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ipfsService: IpfsService,
    private readonly blockchainService: BlockchainService,
  ) {}

  /**
   * Create a new certificate draft
   */
  async createDraft(organizationId: string, dto: CreateCertificateDto) {
    // 1. Fetch organization to get the official organization name
    const organization = await this.prisma.issuingOrganization.findUnique({
      where: { organization_id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Issuing organization not found');
    }

    // 2. Fetch student to get student name and verify they belong to this organization
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: dto.student_id },
    });
    if (!student) {
      throw new NotFoundException('Student account not found');
    }

    if (student.organization_id !== organizationId) {
      throw new ForbiddenException('Student does not belong to your organization');
    }

    // 3. Create draft certificate
    return this.prisma.certificate.create({
      data: {
        organization_id: organizationId,
        student_id: dto.student_id,
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
        status: 'DRAFT',
      },
    });
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
        ...(filters.organization_id && { organization_id: filters.organization_id }),
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
    const certificate = await this.prisma.certificate.findUnique({
      where: { certificate_id: id },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    if (organizationId && certificate.organization_id !== organizationId) {
      throw new ForbiddenException('You do not have access to this certificate');
    }

    return certificate;
  }

  /**
   * Update the status of a certificate draft or pending certificate
   */
  async update(id: string, organizationId: string, dto: UpdateCertificateDto) {
    // 1. Fetch certificate and check ownership
    const certificate = await this.findOne(id, organizationId);

    if (certificate.status === 'ISSUED') {
      throw new BadRequestException('Cannot modify an already ISSUED certificate.');
    }

    // 2. We only allow transitioning status to DRAFT or PENDING
    if (dto.status !== 'DRAFT' && dto.status !== 'PENDING') {
      throw new BadRequestException(
        'Invalid status. Staff can only transition status to DRAFT or PENDING.',
      );
    }

    // 3. Update status
    return this.prisma.certificate.update({
      where: { certificate_id: id },
      data: {
        status: dto.status,
      },
    });
  }

  /**
   * Approve/Issue a pending certificate: upload to IPFS, register on blockchain, and set status to ISSUED
   */
  async approve(id: string, organizationId: string) {
    const certificate = await this.findOne(id, organizationId);

    if (certificate.status === 'ISSUED') {
      throw new BadRequestException('Certificate has already been issued.');
    }

    if (certificate.status !== 'PENDING') {
      throw new BadRequestException(
        'Only certificates with status PENDING can be approved. Please submit the draft to PENDING first.',
      );
    }

    // Verify all required fields for IPFS/Blockchain are present
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

    // 1. Construct IPFS payload
    const ipfsPayload = {
      documentTitle: certificate.certificate_title,
      fullName: certificate.student_fullName,
      dob: certificate.dob!,
      placeOfBirth: certificate.placeOfBirth!,
      gender: certificate.gender!,
      ethnicity: certificate.ethnicity!,
      schoolName: certificate.schoolName!,
      examCohort: certificate.examCohort!,
      examBoard: certificate.examBoard!,
      issueLocation: certificate.issueLocation!,
      issueDate: certificate.issueDate!,
      serialNumber: certificate.serialNumber!,
      registryNumber: certificate.registryNumber!,
    };

    // 2. Upload metadata to IPFS
    const ipfsResult = await this.ipfsService.storeToIpfs(ipfsPayload);
    const cid = ipfsResult.cid;
    const sha3Hash = ipfsResult.sha3Hash;

    let transactionHash: string | null = null;

    // 3. Register on blockchain
    if (this.blockchainService.isInitialized()) {
      try {
        const signature = await this.blockchainService.signHash(sha3Hash);
        const onChainResult = await this.blockchainService.registerCertificate(
          sha3Hash,
          cid,
          signature,
        );
        transactionHash = onChainResult.transactionHash;
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

    // 4. Update the certificate status, cid, and transaction hash
    return this.prisma.certificate.update({
      where: { certificate_id: id },
      data: {
        status: 'ISSUED',
        ipfs_cid: cid,
        tx_hash: transactionHash,
        issuedAt: new Date(),
      },
    });
  }

  /**
   * Delete a certificate draft
   */
  async delete(id: string, organizationId: string) {
    const certificate = await this.findOne(id, organizationId);

    // Drafts and Pendings can be deleted, but issued certificates shouldn't be deleted via CRUD directly.
    if (certificate.status === 'ISSUED') {
      throw new BadRequestException(
        `Cannot delete a certificate that is in 'ISSUED' status.`,
      );
    }

    await this.prisma.certificate.delete({
      where: { certificate_id: id },
    });

    return { message: 'Certificate draft deleted successfully' };
  }
}
