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

    // 4. Fetch the details from IPFS using the CID
    const cid = blockchainData?.cid || certificate.ipfs_cid;
    let ipfsData = null;
    let ipfsFetchSuccess = false;

    if (cid) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 seconds timeout

        const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          ipfsData = await response.json();
          ipfsFetchSuccess = true;
        } else {
          this.logger.warn(`IPFS gateway returned non-ok response: ${response.status}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch certificate data from IPFS: ${error.message}`);
      }
    }

    // 5. Construct details response
    const isValid = isBlockchainValid && certificate.status === 'ISSUED';

    return {
      isValid,
      status: certificate.status,
      blockchain: blockchainData,
      ipfsData: ipfsData || ipfsPayload,
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
        organizationName: certificate.organization?.organization_name || certificate.organization_name,
        organizationId: certificate.organization_id,
        txHash: certificate.tx_hash,
        issuedAt: certificate.issuedAt,
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
