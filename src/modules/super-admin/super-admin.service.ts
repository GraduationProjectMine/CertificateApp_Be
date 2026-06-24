import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InstitutionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { BlockchainService } from '../../core/blockchain/blockchain.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
  ) {}

  async getPendingInstitutions() {
    return this.prisma.institution.findMany({
      where: { status: InstitutionStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getAllInstitutions() {
    return this.prisma.institution.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
        contractAddress: true,
        chainId: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async approveInstitution(institutionId: string, superAdminUserId: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });
    if (!institution) throw new NotFoundException('Không tìm thấy trường');
    if (institution.status !== InstitutionStatus.PENDING) {
      throw new BadRequestException('Đã xử lý trước đó');
    }

    const { address: walletAddress, privateKey } =
      this.blockchain.generateInstitutionWallet();
    const encryptedKey = this.blockchain.encryptPrivateKey(privateKey);

    let contractAddress: string;
    try {
      contractAddress = await this.blockchain.deployNewContract(
        institution.name,
        walletAddress,
      );
    } catch (error) {
      this.logger.error(
        `Contract deploy failed for ${institution.name}`,
        error,
      );
      throw new BadRequestException(
        'Không thể deploy contract. Vui lòng kiểm tra kết nối blockchain.',
      );
    }

    const chainId = Number(process.env.CHAIN_ID || 31337);
    const randomPassword = crypto.randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const adminEmail = institution.email;

    const existingAdmin = await this.prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.institution.update({
        where: { id: institutionId },
        data: {
          status: InstitutionStatus.ACTIVE,
          contractAddress,
          chainId,
          walletAddress,
          walletEncryptedKey: encryptedKey,
        },
      });

      if (existingAdmin) {
        await tx.user.update({
          where: { email: adminEmail },
          data: {
            role: 'institution_admin',
            institutionId,
          },
        });
      } else {
        await tx.user.create({
          data: {
            email: adminEmail,
            password: hashedPassword,
            name: `Quản trị ${institution.name}`,
            role: 'institution_admin',
            institutionId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: superAdminUserId,
          action: 'INSTITUTION_APPROVED',
          targetType: 'Institution',
          targetId: institutionId,
          metadata: {
            name: institution.name,
            contractAddress,
            adminEmail,
          },
        },
      });
    });

    return {
      message: 'Phê duyệt thành công',
      contractAddress,
      chainId,
      adminEmail,
      tempPassword: existingAdmin ? null : randomPassword,
    };
  }

  async rejectInstitution(institutionId: string, superAdminUserId: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });
    if (!institution) throw new NotFoundException('Không tìm thấy trường');
    if (institution.status !== InstitutionStatus.PENDING) {
      throw new BadRequestException('Đã xử lý trước đó');
    }

    await this.prisma.$transaction([
      this.prisma.institution.update({
        where: { id: institutionId },
        data: { status: InstitutionStatus.SUSPENDED },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: superAdminUserId,
          action: 'INSTITUTION_REJECTED',
          targetType: 'Institution',
          targetId: institutionId,
          metadata: { name: institution.name },
        },
      }),
    ]);

    return { message: 'Đã từ chối' };
  }

  async getStats() {
    const [pendingInstitutions, activeInstitutions, totalUsers] =
      await this.prisma.$transaction([
        this.prisma.institution.count({
          where: { status: InstitutionStatus.PENDING },
        }),
        this.prisma.institution.count({
          where: { status: InstitutionStatus.ACTIVE },
        }),
        this.prisma.user.count(),
      ]);

    return {
      pendingInstitutions,
      activeInstitutions,
      totalUsers,
    };
  }
}
