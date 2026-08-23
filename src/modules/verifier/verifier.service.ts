import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { BlockchainService } from '../../core/blockchain/blockchain.service';
import { IpfsService } from '../ipfs/ipfs.service';
import { OcrService } from '../ocr/ocr.service';
import { DiplomaParserService } from '../ocr/diploma-parser.service';

@Injectable()
export class VerifierService {
  private readonly logger = new Logger(VerifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly ipfsService: IpfsService,
    private readonly ocrService: OcrService,
    private readonly diplomaParserService: DiplomaParserService,
  ) {}

  async verifyCertificate(serialNumber: string, registryNumber: string) {
    if (!serialNumber || !registryNumber) {
      throw new BadRequestException(
        'Both serial number (So hieu) and registry number (So vao so cap bang) are required',
      );
    }

    const sTrim = serialNumber.trim();
    const rTrim = registryNumber.trim();

    // 1. Fetch certificate from database
    const certificate = await this.prisma.certificate.findFirst({
      where: {
        OR: [
          { serialNumber: sTrim, registryNumber: rTrim },
          { serialNumber: sTrim.toUpperCase(), registryNumber: rTrim.toUpperCase() },
          { serialNumber: sTrim.toLowerCase(), registryNumber: rTrim.toLowerCase() },
        ],
      },
      include: {
        organization: true,
      },
    });

    if (!certificate) {
      // Fallback: Check online_certificates table
      const onlineCert = await this.prisma.onlineCertificate.findFirst({
        where: {
          OR: [
            { serialNumber: sTrim, registryNumber: rTrim },
            { serialNumber: sTrim.toUpperCase(), registryNumber: rTrim.toUpperCase() },
            { serialNumber: sTrim.toLowerCase(), registryNumber: rTrim.toLowerCase() },
          ],
        },
      });
      if (onlineCert) {
        return this.verifyOnlineCertificate(sTrim, rTrim);
      }
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

        const cidMatches = !certificate.ipfs_cid || 
                           !onChainResult.cid || 
                           certificate.ipfs_cid.includes(onChainResult.cid) || 
                           onChainResult.cid.includes(certificate.ipfs_cid);

        isBlockchainValid = onChainResult.exists && 
                            !onChainResult.isRevoked && 
                            cidMatches;
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
        organizationLogo: certificate.organization?.logo_url || null,
        organizationWallet: certificate.organization?.wallet_address || null,
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
      const onlineCert = await this.prisma.onlineCertificate.findUnique({
        where: {
          certificate_id: id,
        },
      });
      if (onlineCert) {
        return this.verifyOnlineCertificate(onlineCert.serialNumber || '', onlineCert.registryNumber || '');
      }
      throw new NotFoundException('Certificate not found.');
    }

    return this.verifyCertificate(certificate.serialNumber || '', certificate.registryNumber || '');
  }

  async verifyOnlineCertificate(serialNumber: string, registryNumber: string) {
    if (!serialNumber || !registryNumber) {
      throw new BadRequestException(
        'Both serial number (So hieu) and registry number (So vao so cap bang) are required',
      );
    }

    const sTrim = serialNumber.trim();
    const rTrim = registryNumber.trim();

    // 1. Fetch online certificate from database
    const certificate = await this.prisma.onlineCertificate.findFirst({
      where: {
        OR: [
          { serialNumber: sTrim, registryNumber: rTrim },
          { serialNumber: sTrim.toUpperCase(), registryNumber: rTrim.toUpperCase() },
          { serialNumber: sTrim.toLowerCase(), registryNumber: rTrim.toLowerCase() },
        ],
      },
      include: {
        organization: true,
      },
    });

    if (!certificate) {
      throw new NotFoundException(
        'Online certificate not found with the provided serial and registry numbers.',
      );
    }

    // 2. Construct IPFS payload for Online Certificate
    const ipfsPayload = {
      documentTitle: certificate.certificate_title,
      fullName: certificate.student_fullName,
      serialNumber: certificate.serialNumber ?? '',
      registryNumber: certificate.registryNumber ?? '',
    };

    const calculatedSha3Hash = this.ipfsService.calculateOnlineCertSha3Hash(ipfsPayload);

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

        const cidMatches = !certificate.ipfs_cid || 
                           !onChainResult.cid || 
                           certificate.ipfs_cid.includes(onChainResult.cid) || 
                           onChainResult.cid.includes(certificate.ipfs_cid);

        isBlockchainValid = onChainResult.exists && 
                            !onChainResult.isRevoked && 
                            cidMatches;
      } catch (error) {
        this.logger.error(`Blockchain verification failed for online cert hash ${calculatedSha3Hash}:`, error);
        isBlockchainValid = false;
      }
    }

    const cid = blockchainData?.cid || certificate.ipfs_cid;
    const fileUrl =
      certificate.file_url ||
      (cid ? `https://gateway.pinata.cloud/ipfs/${cid}` : null);
    const ipfsData: any = { fileUrl, cid };

    const isValid = isBlockchainValid && certificate.status === 'ISSUED';

    return {
      isValid,
      isOnlineCertificate: true,
      status: certificate.status,
      blockchain: blockchainData,
      ipfsData,
      ipfsFetchSuccess: !!cid,
      certificateDetails: {
        certificateId: certificate.certificate_id,
        certificateTitle: certificate.certificate_title,
        studentFullName: certificate.student_fullName,
        dob: certificate.dob || null,
        placeOfBirth: certificate.placeOfBirth || null,
        gender: certificate.gender || null,
        ethnicity: certificate.ethnicity || null,
        schoolName: certificate.schoolName || null,
        examCohort: certificate.examCohort || null,
        examBoard: certificate.examBoard || null,
        issueLocation: certificate.issueLocation || null,
        issueDate: certificate.issueDate || null,
        serialNumber: certificate.serialNumber,
        registryNumber: certificate.registryNumber,
        fileUrl,
        organizationName: certificate.organization?.organization_name || certificate.organization_name || 'CertiChain Organization',
        organizationId: certificate.organization_id,
        organizationLogo: certificate.organization?.logo_url || null,
        organizationWallet: certificate.organization?.wallet_address || null,
        txHash: certificate.tx_hash,
        issuedAt: certificate.issuedAt,
        revokedAt: null,
        revokeReason: null,
        revokeTransactionHash: null,
      },
    };
  }

  async getOnlineCertificateById(id: string) {
    const certificate = await this.prisma.onlineCertificate.findUnique({
      where: {
        certificate_id: id,
      },
    });

    if (!certificate) {
      throw new NotFoundException('Online certificate not found.');
    }

    return this.verifyOnlineCertificate(certificate.serialNumber || '', certificate.registryNumber || '');
  }

  async scanDiplomaOcr(file: any) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No diploma image file provided');
    }
    const ocrResult = await this.ocrService.extractTextFromImage(file.buffer, 'vie');
    const parsed = this.diplomaParserService.parse(ocrResult.extractedText);

    let serialNumber = parsed.data.serial_number;
    let registryNumber = parsed.data.registry_number;

    const rawText = ocrResult.extractedText;

    if (!serialNumber) {
      const serialMatch = rawText.match(/\b([A-Za-z]\d{5,10}|[A-Z]{1,2}\s*\d{6,8})\b/);
      if (serialMatch) serialNumber = serialMatch[1].replace(/\s+/g, '');
    }

    if (!registryNumber) {
      const regMatch = rawText.match(/\b(\d{4}\/\d{2,4}|\d{6,10})\b/);
      if (regMatch) registryNumber = regMatch[1];
    }

    return {
      serialNumber: serialNumber || null,
      registryNumber: registryNumber || null,
      accuracy: ocrResult.accuracy,
      rawText: ocrResult.extractedText,
    };
  }
}

