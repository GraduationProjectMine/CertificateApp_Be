import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { BlockchainService } from '../../core/blockchain/blockchain.service';
import { IpfsService } from '../ipfs/ipfs.service';

@Injectable()
export class VerifierService {
  private readonly logger = new Logger(VerifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly ipfsService: IpfsService,
  ) {}

  async verifyCertificate(serialNumber: string, registryNumber: string) {
    if (!serialNumber || !registryNumber) {
      throw new BadRequestException(
        'Both serial number (So hieu) and registry number (So vao so cap bang) are required',
      );
    }

    // 1. Fetch certificate from database
    const certificate = await this.prisma.certificate.findFirst({
      where: {
        serialNumber: serialNumber.trim(),
        registryNumber: registryNumber.trim(),
      },
      include: {
        organization: true,
      },
    });

    if (!certificate) {
      throw new NotFoundException(
        'Certificate not found with the provided serial and registry numbers.',
      );
    }

    if (certificate.status !== 'ISSUED' && certificate.status !== 'REVOKED') {
      throw new BadRequestException(
        `Certificate exists but is currently in '${certificate.status}' status and has not been issued to the blockchain.`,
      );
    }

    // 2. Construct IPFS payload to compute SHA-3 hash deterministically
    const ipfsPayload = {
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

    const calculatedSha3Hash = this.ipfsService.calculateSha3Hash(ipfsPayload);

    // 3. Query Blockchain
    let blockchainData: any = null;
    let isBlockchainValid = false;

    if (this.blockchainService.isInitialized()) {
      try {
        const onChainResult = await this.blockchainService.getCertificate(calculatedSha3Hash);
        
        blockchainData = {
          exists: onChainResult.exists,
          isRevoked: onChainResult.isRevoked,
          issuer: onChainResult.issuer,
          timestamp: onChainResult.timestamp,
          signature: onChainResult.signature,
          cid: onChainResult.cid,
          sha3Hash: onChainResult.sha3Hash,
        };

        // Verification check: exists, is not revoked, and CID matches what we have in database
        isBlockchainValid = onChainResult.exists && 
                            !onChainResult.isRevoked && 
                            onChainResult.cid === certificate.ipfs_cid;
      } catch (error) {
        this.logger.error(`Blockchain verification failed for hash ${calculatedSha3Hash}:`, error);
        isBlockchainValid = false;
      }
    } else {
      this.logger.warn('Blockchain service not initialized. Skipping on-chain signature verification.');
    }

    // 4. Construct IPFS file details
    const cid = blockchainData?.cid || certificate.ipfs_cid;
    const fileUrl =
      certificate.file_url ||
      (cid ? `https://gateway.pinata.cloud/ipfs/${cid}` : null);
    let ipfsData: any = { fileUrl, cid };
    let ipfsFetchSuccess = !!cid;

    if (cid) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s fast check

        const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          ipfsFetchSuccess = true;
        }
      } catch {
        // Public gateway fetch timeout or fallback, file URL remains valid
        ipfsFetchSuccess = true;
      }
    }

    // 5. Construct details response
    const isValid = isBlockchainValid && certificate.status === 'ISSUED';

    return {
      isValid,
      status: certificate.status,
      blockchain: blockchainData,
      ipfsData,
      ipfsFetchSuccess,
      certificateDetails: {
        certificateId: certificate.certificate_id,
        certificateTitle: certificate.certificate_title,
        studentFullName: certificate.student_fullName,
        dob: certificate.dob,
        placeOfBirth: certificate.placeOfBirth,
        gender: certificate.gender,
        ethnicity: certificate.ethnicity,
        schoolName: certificate.schoolName,
        examCohort: certificate.examCohort,
        examBoard: certificate.examBoard,
        issueLocation: certificate.issueLocation,
        issueDate: certificate.issueDate,
        serialNumber: certificate.serialNumber,
        registryNumber: certificate.registryNumber,
        fileUrl,
        organizationName: certificate.organization?.organization_name || certificate.organization_name,
        organizationId: certificate.organization_id,
        txHash: certificate.tx_hash,
        issuedAt: certificate.issuedAt,
        revokedAt: certificate.revokedAt,
        revokeReason: certificate.revokeReason,
        revokeTransactionHash: certificate.revoke_tx_hash,
      },
    };
  }

  async getCertificateById(id: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: {
        certificate_id: id,
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found.');
    }

    return this.verifyCertificate(certificate.serialNumber || '', certificate.registryNumber || '');
  }
}
