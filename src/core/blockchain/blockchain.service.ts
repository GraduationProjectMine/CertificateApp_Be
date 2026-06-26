import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ethers } from 'ethers';
import * as contractArtifact from './abi/CertificateRegistry.json';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;

  onModuleInit() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS;

    if (!rpcUrl || !privateKey || !contractAddress) {
      this.logger.warn(
        'Warning: Blockchain environment variables are not fully configured. ' +
          'Please set BLOCKCHAIN_RPC_URL, BLOCKCHAIN_PRIVATE_KEY, and BLOCKCHAIN_CONTRACT_ADDRESS in .env.',
      );
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(
        contractAddress,
        contractArtifact.abi,
        this.wallet,
      );
      this.logger.log(
        `BlockchainService initialized successfully. Contract Address: ${contractAddress}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize blockchain service:', error);
    }
  }

  private ensureInitialized(): ethers.Contract {
    if (!this.contract) {
      throw new InternalServerErrorException(
        'Blockchain service is not initialized. Please verify your environment variables (.env).',
      );
    }
    return this.contract;
  }

  private formatBytes32(hexString: string): string {
    let cleanHex = hexString.trim();
    if (cleanHex.startsWith('0x')) {
      cleanHex = cleanHex.slice(2);
    }
    if (cleanHex.length !== 64) {
      throw new Error(
        `Invalid 32-byte hex string (must be 64 characters): ${hexString}`,
      );
    }
    return `0x${cleanHex}`;
  }

  /**
   * Registers a new certificate hash, CID, and signature on-chain.
   */
  async registerCertificate(sha3Hash: string, cid: string, signature: string) {
    const contract = this.ensureInitialized();
    try {
      const formattedHash = this.formatBytes32(sha3Hash);
      const tx = await contract.registerCertificate(
        formattedHash,
        cid,
        signature,
      );
      const receipt = await tx.wait();
      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt?.blockNumber ?? null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to register certificate hash ${sha3Hash} on-chain:`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to register certificate on-chain: ${error.message}`,
      );
    }
  }

  /**
   * Revokes an existing certificate on-chain.
   */
  async revokeCertificate(sha3Hash: string) {
    const contract = this.ensureInitialized();
    try {
      const formattedHash = this.formatBytes32(sha3Hash);
      const tx = await contract.revokeCertificate(formattedHash);
      const receipt = await tx.wait();
      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt?.blockNumber ?? null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to revoke certificate hash ${sha3Hash} on-chain:`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to revoke certificate on-chain: ${error.message}`,
      );
    }
  }

  /**
   * Retrieves certificate details by its hash from the blockchain.
   */
  async getCertificate(sha3Hash: string) {
    const contract = this.ensureInitialized();
    try {
      const formattedHash = this.formatBytes32(sha3Hash);
      const result = await contract.getCertificate(formattedHash);
      return {
        sha3Hash: result[0],
        cid: result[1],
        signature: result[2],
        issuer: result[3],
        timestamp: Number(result[4]),
        isRevoked: result[5],
        exists: result[6],
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve certificate details for hash ${sha3Hash}:`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve certificate details: ${error.message}`,
      );
    }
  }
}
