import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { BlockchainService } from '../../core/blockchain/blockchain.service';
import { CryptoService } from '../../core/crypto/crypto.service';

@Injectable()
export class IssuerService {
  private readonly logger = new Logger(IssuerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(organization_name: string, contact_email: string) {
    const { address, privateKey } = this.blockchainService.createOrgWallet();

    const encryptedPK = this.cryptoService.encrypt(privateKey);

    if (this.blockchainService.isInitialized()) {
      try {
        await this.blockchainService.authorizeIssuer(address);
      } catch (error) {
        this.logger.error(`Failed to authorize issuer ${address} on-chain: ${error.message}`);
        throw new InternalServerErrorException(
          'Failed to authorize organization on blockchain. Please try again.',
        );
      }
    } else {
      this.logger.warn(
        'Blockchain not initialized. Organization created without on-chain authorization.',
      );
    }

    return this.prisma.issuingOrganization.create({
      data: {
        organization_name,
        contact_email,
        wallet_address: address,
        encrypted_private_key: encryptedPK,
        is_verified: false,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.issuingOrganization.findUnique({
      where: { organization_id: id },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.issuingOrganization.findUnique({
      where: { contact_email: email },
    });
  }

  async findAll() {
    return this.prisma.issuingOrganization.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  async update(
    id: string,
    data: {
      organization_name?: string;
      contact_email?: string;
      logo_url?: string;
      is_verified?: boolean;
      wallet_address?: string;
    },
  ) {
    const org = await this.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.issuingOrganization.update({
      where: { organization_id: id },
      data,
    });
  }

  async delete(id: string) {
    const org = await this.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    await this.prisma.issuingOrganization.delete({
      where: { organization_id: id },
    });

    return { message: 'Organization deleted successfully' };
  }
}
