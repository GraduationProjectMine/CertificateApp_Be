import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHash } from 'crypto';
import { StoreCertificateDto, StoreCertificateResponseDto } from './ipfs.dto';

@Injectable()
export class IpfsService {
  /**
   * Hashes the certificate data using SHA-3 (sha3-256) in a deterministic format.
   */
  calculateSha3Hash(data: StoreCertificateDto): string {
    // Sort keys to ensure deterministic hashing
    const sortedData = {
      documentTitle: data.documentTitle,
      fullName: data.fullName,
      dob: data.dob,
      placeOfBirth: data.placeOfBirth,
      gender: data.gender,
      ethnicity: data.ethnicity,
      schoolName: data.schoolName,
      examCohort: data.examCohort,
      examBoard: data.examBoard,
      issueLocation: data.issueLocation,
      issueDate: data.issueDate,
      serialNumber: data.serialNumber,
      registryNumber: data.registryNumber,
    };

    const serialized = JSON.stringify(sortedData);
    return createHash('sha3-256').update(serialized).digest('hex');
  }

  /**
   * Stores the certificate data and its SHA-3 hash to IPFS using Pinata API.
   */
  async storeToIpfs(
    data: StoreCertificateDto,
  ): Promise<StoreCertificateResponseDto> {
    const sha3Hash = this.calculateSha3Hash(data);

    // Prepare headers for Pinata API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const pinataJwt = process.env.PINATA_JWT;
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataApiSecret = process.env.PINATA_API_SECRET;

    if (pinataJwt) {
      headers['Authorization'] = `Bearer ${pinataJwt}`;
    } else if (pinataApiKey && pinataApiSecret) {
      headers['pinata_api_key'] = pinataApiKey;
      headers['pinata_secret_api_key'] = pinataApiSecret;
    } else {
      throw new InternalServerErrorException(
        'Pinata credentials are not configured in environment variables (.env). Please set PINATA_JWT or PINATA_API_KEY and PINATA_API_SECRET.',
      );
    }

    const payload = {
      pinataContent: {
        ...data,
        sha3Hash,
      },
      pinataMetadata: {
        name: `certificate_${data.registryNumber || 'unnamed'}_${data.serialNumber || 'unnamed'}`,
        keyvalues: {
          fullName: data.fullName || '',
          registryNumber: data.registryNumber || '',
          serialNumber: data.serialNumber || '',
          sha3Hash: sha3Hash,
        },
      },
      pinataOptions: {
        cidVersion: 1,
      },
    };

    try {
      const response = await fetch(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Pinata API response error: status ${response.status} - ${errorText}`,
        );
      }

      const responseData = (await response.json()) as { IpfsHash: string };
      const cid = responseData.IpfsHash;

      return {
        cid,
        ipfsUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
        sha3Hash,
        data,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload to IPFS: ${error.message}`,
      );
    }
  }
}
