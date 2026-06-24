import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private adminWallet: ethers.Wallet;
  private contractABI: any[] = [];

  async onModuleInit() {
    this.provider = new ethers.JsonRpcProvider(
      process.env.RPC_URL || 'http://127.0.0.1:8545',
    );
    this.adminWallet = new ethers.Wallet(
      process.env.ADMIN_PRIVATE_KEY || '',
      this.provider,
    );
    this.loadABI();
    this.logger.log('BlockchainService initialized');
  }

  private loadABI() {
    const candidatePaths = [
      path.resolve(
        process.cwd(),
        'bc/deployments/CertificateRegistry.abi.json',
      ),
      path.resolve(
        process.cwd(),
        'bc/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json',
      ),
    ];
    for (const abiPath of candidatePaths) {
      if (!fs.existsSync(abiPath)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        this.contractABI = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.abi)
            ? parsed.abi
            : [];
        if (this.contractABI.length > 0) {
          this.logger.log(`Loaded ABI from ${abiPath}`);
          return;
        }
      } catch {}
    }
    this.logger.warn('No ABI found - blockchain write operations will fail');
  }

  private loadContractBytecode(): string {
    const candidatePaths = [
      path.resolve(
        process.cwd(),
        'bc/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json',
      ),
    ];
    for (const abiPath of candidatePaths) {
      if (!fs.existsSync(abiPath)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        if (parsed?.bytecode) {
          return typeof parsed.bytecode === 'object'
            ? parsed.bytecode.object
            : parsed.bytecode;
        }
      } catch {}
    }
    throw new Error('Cannot load contract bytecode. Build contracts first.');
  }

  private getContract(contractAddress: string, signer?: ethers.Signer): any {
    return new ethers.Contract(
      contractAddress,
      this.contractABI,
      signer || this.adminWallet,
    );
  }

  async deployNewContract(
    institutionName: string,
    institutionWalletAddress?: string,
  ) {
    const bytecode = this.loadContractBytecode();
    const factory = new ethers.ContractFactory(
      this.contractABI,
      bytecode,
      this.adminWallet,
    );
    const contract: any = await factory.deploy(institutionName);
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    this.logger.log(
      `Deployed contract for ${institutionName} at ${contractAddress}`,
    );

    if (institutionWalletAddress) {
      const ISSUER_ROLE = await contract.ISSUER_ROLE();
      const tx = await contract.grantRole(
        ISSUER_ROLE,
        institutionWalletAddress,
      );
      await tx.wait();
      this.logger.log(`Granted ISSUER_ROLE to ${institutionWalletAddress}`);
    }

    return contractAddress;
  }

  generateInstitutionWallet(): { address: string; privateKey: string } {
    const wallet = ethers.Wallet.createRandom();
    return { address: wallet.address, privateKey: wallet.privateKey };
  }

  encryptPrivateKey(privateKey: string): string {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not set');
    const key = crypto.scryptSync(encryptionKey, 'blockcert-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decryptPrivateKey(encryptedKey: string): string {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not set');
    const parts = encryptedKey.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted key format');
    const key = crypto.scryptSync(encryptionKey, 'blockcert-salt', 32);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(parts[0], 'hex'),
    );
    decipher.setAuthTag(Buffer.from(parts[1], 'hex'));
    let decrypted = decipher.update(parts[2], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async getInstitutionSigner(contractAddress: string): Promise<ethers.Wallet> {
    return new ethers.Wallet(
      process.env.ADMIN_PRIVATE_KEY || '',
      this.provider,
    );
  }

  async ensureIssuerCanIssue(contractAddress: string) {
    const contract = this.getContract(contractAddress);
    const walletAddress = await this.adminWallet.getAddress();
    const issuerRole = await contract.ISSUER_ROLE();
    const hasRole = await contract.hasRole(issuerRole, walletAddress);
    if (!hasRole)
      throw new Error(
        `Admin wallet ${walletAddress} lacks ISSUER_ROLE on ${contractAddress}`,
      );
  }

  async issueCertificateOnChain(
    contractAddress: string,
    certData: {
      certificateId: string;
      certificateHash: string;
      ipfsMetadataCID: string;
    },
  ) {
    const contract = this.getContract(contractAddress);
    const hash = certData.certificateHash.startsWith('0x')
      ? certData.certificateHash
      : `0x${certData.certificateHash}`;
    const tx = await contract.issueCertificate(
      certData.certificateId,
      hash,
      certData.ipfsMetadataCID,
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async revokeCertificateOnChain(
    contractAddress: string,
    certificateId: string,
    reason: string,
  ) {
    const contract = this.getContract(contractAddress);
    const tx = await contract.revokeCertificate(certificateId, reason);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getCertificateFromChain(
    contractAddress: string,
    certificateId: string,
  ) {
    const contract = this.getContract(contractAddress);
    return contract.getCertificateProof(certificateId);
  }

  async getStats(contractAddress: string) {
    const contract = this.getContract(contractAddress);
    const stats = await contract.getStats();
    return {
      total: Number(stats.total),
      revoked: Number(stats.revoked),
      active: Number(stats.active),
    };
  }

  adminAddress(): string {
    return this.adminWallet?.address || '';
  }
}
