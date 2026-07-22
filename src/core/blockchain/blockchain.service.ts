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
  readonly logger = new Logger(BlockchainService.name);
  provider: ethers.JsonRpcProvider | null = null;
  adminWallet: ethers.Wallet | null = null;
  adminContract: ethers.Contract | null = null;
  contractAddress: string = '';

  onModuleInit() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL;
    const privateKey =
      process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY;
    this.contractAddress =
      process.env.BLOCKCHAIN_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || '';

    if (!rpcUrl || !privateKey || !this.contractAddress) {
      this.logger.warn(
        'Warning: Blockchain environment variables are not fully configured. ' +
          'Please set RPC_URL/BLOCKCHAIN_RPC_URL, ADMIN_PRIVATE_KEY/BLOCKCHAIN_PRIVATE_KEY, and CONTRACT_ADDRESS/BLOCKCHAIN_CONTRACT_ADDRESS in .env.',
      );
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.adminWallet = new ethers.Wallet(privateKey, this.provider);
      this.adminContract = new ethers.Contract(
        this.contractAddress,
        contractArtifact.abi,
        this.adminWallet,
      );
      this.logger.log(
        `BlockchainService initialized successfully. Contract Address: ${this.contractAddress}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize blockchain service:', error);
    }
  }

  private ensureInitialized(): ethers.Contract {
    if (!this.adminContract) {
      throw new InternalServerErrorException(
        'Blockchain service is not initialized. Please verify your environment variables (.env).',
      );
    }
    return this.adminContract;
  }

  private ensureProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      throw new InternalServerErrorException(
        'Blockchain provider not initialized.',
      );
    }
    return this.provider;
  }

  isInitialized(): boolean {
    return !!this.adminContract && !!this.adminWallet;
  }

  async signHash(sha3Hash: string): Promise<string> {
    if (!this.adminWallet) {
      throw new InternalServerErrorException(
        'Blockchain wallet not initialized. Cannot sign hash.',
      );
    }
    return this.adminWallet.signMessage(sha3Hash);
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

  async registerCertificate(sha3Hash: string, cid: string, signature: string) {
    const contract = this.ensureInitialized();
    try {
      const formattedHash = this.formatBytes32(sha3Hash);
      const tx = await contract.registerCertificate(formattedHash, cid, signature);
      const receipt = await tx.wait();
      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt?.blockNumber ?? null,
        gasUsed: receipt?.gasUsed?.toString() ?? null,
      };
    } catch (error) {
      this.logger.error(`Failed to register certificate hash ${sha3Hash} on-chain:`, error);
      throw new InternalServerErrorException(
        `Failed to register certificate on-chain: ${error.message}`,
      );
    }
  }

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
        gasUsed: receipt?.gasUsed?.toString() ?? null,
      };
    } catch (error) {
      this.logger.error(`Failed to revoke certificate hash ${sha3Hash} on-chain:`, error);
      throw new InternalServerErrorException(
        `Failed to revoke certificate on-chain: ${error.message}`,
      );
    }
  }

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
      this.logger.error(`Failed to retrieve certificate details for hash ${sha3Hash}:`, error);
      throw new InternalServerErrorException(
        `Failed to retrieve certificate details: ${error.message}`,
      );
    }
  }

  async getHealth() {
    const contractAddress = this.contractAddress || null;
    if (!this.provider || !this.adminWallet || !this.adminContract) {
      return {
        connected: false,
        network: null,
        chainId: null,
        blockNumber: null,
        contractAddress,
        walletAddress: null,
        walletBalance: null,
      };
    }
    try {
      const [network, blockNumber, balance] = await Promise.all([
        this.provider.getNetwork(),
        this.provider.getBlockNumber(),
        this.provider.getBalance(this.adminWallet.address),
      ]);
      return {
        connected: true,
        network: network.name,
        chainId: Number(network.chainId),
        blockNumber,
        contractAddress,
        walletAddress: this.adminWallet.address,
        walletBalance: ethers.formatEther(balance),
      };
    } catch (error) {
      this.logger.warn(`Blockchain health check failed: ${error.message}`);
      return {
        connected: false,
        network: null,
        chainId: null,
        blockNumber: null,
        contractAddress,
        walletAddress: this.adminWallet.address,
        walletBalance: null,
      };
    }
  }

  async getTransactionReceipt(transactionHash: string) {
    if (!this.provider) return null;
    try {
      const receipt = await this.provider.getTransactionReceipt(transactionHash);
      if (!receipt) return null;
      return {
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'SUCCESS' : 'FAILED',
      };
    } catch {
      return null;
    }
  }

  // ==================== Multi-Wallet (Per-Org) Methods ====================

  createOrgWallet(): { address: string; privateKey: string } {
    const wallet = ethers.Wallet.createRandom();
    return { address: wallet.address, privateKey: wallet.privateKey };
  }

  async authorizeIssuer(address: string): Promise<{ transactionHash: string }> {
    const contract = this.ensureInitialized();
    try {
      const tx = await contract.authorizeIssuer(address);
      await tx.wait();
      this.logger.log(`Authorized issuer ${address} on-chain`);
      return { transactionHash: tx.hash };
    } catch (error) {
      this.logger.error(`Failed to authorize issuer ${address}:`, error);
      throw new InternalServerErrorException(
        `Failed to authorize issuer on-chain: ${error.message}`,
      );
    }
  }

  async deauthorizeIssuer(address: string): Promise<{ transactionHash: string }> {
    const contract = this.ensureInitialized();
    try {
      const tx = await contract.deauthorizeIssuer(address);
      await tx.wait();
      this.logger.log(`Deauthorized issuer ${address} on-chain`);
      return { transactionHash: tx.hash };
    } catch (error) {
      this.logger.error(`Failed to deauthorize issuer ${address}:`, error);
      throw new InternalServerErrorException(
        `Failed to deauthorize issuer on-chain: ${error.message}`,
      );
    }
  }

  async registerCertificateAsOrg(
    orgPrivateKey: string,
    sha3Hash: string,
    cid: string,
  ) {
    const provider = this.ensureProvider();
    const orgWallet = new ethers.Wallet(orgPrivateKey, provider);
    const orgContract = new ethers.Contract(
      this.contractAddress,
      contractArtifact.abi,
      orgWallet,
    );
    try {
      const formattedHash = this.formatBytes32(sha3Hash);
      const signature = await orgWallet.signMessage(formattedHash);
      const tx = await orgContract.registerCertificate(formattedHash, cid, signature);
      const receipt = await tx.wait();
      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt?.blockNumber ?? null,
        gasUsed: receipt?.gasUsed?.toString() ?? null,
        issuer: orgWallet.address,
      };
    } catch (error) {
      this.logger.error(
        `Failed to register certificate as org ${orgWallet.address}:`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to register certificate on-chain: ${error.message}`,
      );
    }
  }

  async revokeCertificateAsOrg(orgPrivateKey: string, sha3Hash: string) {
    const provider = this.ensureProvider();
    const orgWallet = new ethers.Wallet(orgPrivateKey, provider);
    const orgContract = new ethers.Contract(
      this.contractAddress,
      contractArtifact.abi,
      orgWallet,
    );
    try {
      const formattedHash = this.formatBytes32(sha3Hash);
      const tx = await orgContract.revokeCertificate(formattedHash);
      const receipt = await tx.wait();
      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt?.blockNumber ?? null,
        gasUsed: receipt?.gasUsed?.toString() ?? null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to revoke certificate as org ${orgWallet.address}:`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to revoke certificate on-chain: ${error.message}`,
      );
    }
  }

  async getOrgBalance(address: string): Promise<string> {
    const provider = this.ensureProvider();
    try {
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch {
      return '0';
    }
  }

  async fundOrgWallet(address: string, amountInEth: string): Promise<{ transactionHash: string }> {
    if (!this.adminWallet) {
      throw new InternalServerErrorException('Admin wallet not initialized');
    }
    const provider = this.ensureProvider();
    try {
      const tx = await this.adminWallet.sendTransaction({
        to: address,
        value: ethers.parseEther(amountInEth),
      });
      await tx.wait();
      this.logger.log(`Funded ${address} with ${amountInEth} ETH`);
      return { transactionHash: tx.hash };
    } catch (error) {
      this.logger.error(`Failed to fund wallet ${address}:`, error);
      throw new InternalServerErrorException(
        `Failed to fund wallet: ${error.message}`,
      );
    }
  }

  async isAuthorizedIssuer(address: string): Promise<boolean> {
    const contract = this.ensureInitialized();
    try {
      return await contract.authorizedIssuers(address);
    } catch {
      return false;
    }
  }
}
