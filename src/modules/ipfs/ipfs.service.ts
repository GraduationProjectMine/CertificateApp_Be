import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHash } from 'crypto';
import { StoreCertificateDto, StoreCertificateResponseDto, StoreOnlineCertificateDto } from './ipfs.dto';

@Injectable()
export class IpfsService {
  async getHealth() {
    const pinataJwt = process.env.PINATA_JWT;
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataApiSecret = process.env.PINATA_API_SECRET;
    const headers: Record<string, string> = {};
    if (pinataJwt) headers.Authorization = `Bearer ${pinataJwt}`;
    else if (pinataApiKey && pinataApiSecret) {
      headers.pinata_api_key = pinataApiKey;
      headers.pinata_secret_api_key = pinataApiSecret;
    } else {
      return {
        connected: false,
        gateway: 'https://gateway.pinata.cloud',
        error: 'Pinata credentials are not configured',
      };
    }

    try {
      const response = await fetch(
        'https://api.pinata.cloud/data/testAuthentication',
        {
          headers,
          signal: AbortSignal.timeout(5000),
        },
      );
      return {
        connected: response.ok,
        gateway: 'https://gateway.pinata.cloud',
        error: response.ok ? null : `Pinata returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        connected: false,
        gateway: 'https://gateway.pinata.cloud',
        error: error.message,
      };
    }
  }

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

  /**
   * Hashes a raw binary file buffer using SHA-3 (sha3-256).
   */
  calculateFileSha3Hash(fileBuffer: Buffer): string {
    return createHash('sha3-256').update(fileBuffer).digest('hex');
  }

  /**
   * Auto-generates a clean, unique filename preserving original extension.
   * e.g., 'my_scan.png' -> 'cert_1721768400000_a1b2c3.png'
   */
  generateFormattedFileName(originalName?: string, mimeType?: string): string {
    const ext = originalName?.includes('.')
      ? originalName.substring(originalName.lastIndexOf('.'))
      : mimeType
        ? `.${mimeType.split('/')[1] || 'png'}`
        : '.png';
    const cleanExt = ext.replace(/[^a-zA-Z0-9\.]/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `cert_${Date.now()}_${randomSuffix}${cleanExt}`;
  }

  /**
   * Stores a binary file (image, document) directly to IPFS using Pinata pinFileToIPFS API.
   * Automatically renames the file before pinning to ensure unique, standardized naming.
   */
  async storeFileToIpfs(
    fileBuffer: Buffer,
    fileName?: string,
    mimeType: string = 'application/octet-stream',
    metadata?: Record<string, string>,
  ): Promise<{ cid: string; ipfsUrl: string; sha3Hash: string; fileName: string }> {
    const formattedFileName = this.generateFormattedFileName(fileName, mimeType);
    const sha3Hash = this.calculateFileSha3Hash(fileBuffer);

    const headers: Record<string, string> = {};
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
        'Pinata credentials are not configured in environment variables (.env).',
      );
    }

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append('file', blob, formattedFileName);

    const pinataMetadata = {
      name: formattedFileName,
      keyvalues: {
        originalName: fileName || '',
        sha3Hash,
        ...metadata,
      },
    };
    formData.append('pinataMetadata', JSON.stringify(pinataMetadata));
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    try {
      const response = await fetch(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        {
          method: 'POST',
          headers,
          body: formData,
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
        fileName: formattedFileName,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload file to IPFS: ${error.message}`,
      );
    }
  }

  /**
   * Hashes the online certificate data using SHA-3 (sha3-256) for template-issued certificates.
   */
  calculateOnlineCertSha3Hash(data: StoreOnlineCertificateDto): string {
    const sortedData = {
      documentTitle: data.documentTitle || 'CHỨNG NHẬN / VĂN BẰNG',
      fullName: data.fullName || '',
      serialNumber: data.serialNumber || '',
      registryNumber: data.registryNumber || '',
    };

    const serialized = JSON.stringify(sortedData);
    return createHash('sha3-256').update(serialized).digest('hex');
  }

  /**
   * Stores the online certificate JSON payload to IPFS.
   */
  async storeOnlineCertToIpfs(
    data: StoreOnlineCertificateDto,
  ): Promise<StoreCertificateResponseDto> {
    const sha3Hash = this.calculateOnlineCertSha3Hash(data);

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
        'Pinata credentials are not configured in environment variables (.env).',
      );
    }

    const payload = {
      pinataContent: {
        documentTitle: data.documentTitle || 'CHỨNG NHẬN / VĂN BẰNG',
        fullName: data.fullName || '',
        serialNumber: data.serialNumber || '',
        registryNumber: data.registryNumber || '',
        template_id: data.template_id || null,
        sha3Hash,
      },
      pinataMetadata: {
        name: `online_cert_${data.registryNumber || 'unnamed'}_${data.serialNumber || 'unnamed'}`,
        keyvalues: {
          fullName: data.fullName || '',
          registryNumber: data.registryNumber || '',
          serialNumber: data.serialNumber || '',
          sha3Hash: sha3Hash,
          isOnlineCert: 'true',
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
        data: data as any,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to store online certificate JSON to IPFS: ${error.message}`,
      );
    }
  }
}

