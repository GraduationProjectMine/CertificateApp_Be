import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../core/prisma/prisma.service';
import { BlockchainService } from '../../core/blockchain/blockchain.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { IpfsService } from '../ipfs/ipfs.service';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly cryptoService: CryptoService,
    private readonly ipfsService: IpfsService,
  ) {}

  async getDashboard() {
    const [
      totalOrganizations,
      pendingOrganizations,
      verifiedOrganizations,
      totalStaff,
      totalStudents,
      totalCertificates,
      issuedCertificates,
      pendingCertificates,
      revokedCertificates,
    ] = await Promise.all([
      this.prisma.issuingOrganization.count(),
      this.prisma.issuingOrganization.count({ where: { is_verified: false } }),
      this.prisma.issuingOrganization.count({ where: { is_verified: true } }),
      this.prisma.staffAccount.count(),
      this.prisma.studentAccount.count(),
      this.prisma.certificate.count(),
      this.prisma.certificate.count({ where: { status: 'ISSUED' } }),
      this.prisma.certificate.count({ where: { status: 'PENDING' } }),
      this.prisma.certificate.count({ where: { status: 'REVOKED' } }),
    ]);

    return {
      organizations: {
        total: totalOrganizations,
        pending: pendingOrganizations,
        verified: verifiedOrganizations,
      },
      users: {
        total: totalStaff + totalStudents,
        staff: totalStaff,
        students: totalStudents,
      },
      certificates: {
        total: totalCertificates,
        issued: issuedCertificates,
        pending: pendingCertificates,
        revoked: revokedCertificates,
      },
    };
  }

  async findAllOrganizations(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const where: any = {};

    if (query.status === 'verified') {
      where.is_verified = true;
    } else if (query.status === 'pending') {
      where.is_verified = false;
    }

    if (query.search) {
      where.OR = [
        { organization_name: { contains: query.search } },
        { contact_email: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.issuingOrganization.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              staff_accounts: true,
              student_accounts: true,
              certificates: true,
            },
          },
        },
      }),
      this.prisma.issuingOrganization.count({ where }),
    ]);

    return {
      items: items.map((org) => ({
        organization_id: org.organization_id,
        organization_name: org.organization_name,
        contact_email: org.contact_email,
        logo_url: org.logo_url,
        is_verified: org.is_verified,
        wallet_address: org.wallet_address,
        created_at: org.created_at,
        stats: {
          staff: org._count.staff_accounts,
          students: org._count.student_accounts,
          certificates: org._count.certificates,
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOrganizationById(id: string) {
    const org = await this.prisma.issuingOrganization.findUnique({
      where: { organization_id: id },
      include: {
        staff_accounts: {
          select: {
            staff_id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            student_accounts: true,
            certificates: true,
            templates: true,
          },
        },
      },
    });

    if (!org) return null;

    return {
      organization_id: org.organization_id,
      organization_name: org.organization_name,
      contact_email: org.contact_email,
      logo_url: org.logo_url,
      is_verified: org.is_verified,
      wallet_address: org.wallet_address,
      created_at: org.created_at,
      staff_accounts: org.staff_accounts,
      stats: {
        students: org._count.student_accounts,
        certificates: org._count.certificates,
        templates: org._count.templates,
      },
    };
  }

  async verifyOrganization(id: string) {
    return this.prisma.issuingOrganization.update({
      where: { organization_id: id },
      data: { is_verified: true },
    });
  }

  async suspendOrganization(id: string) {
    return this.prisma.issuingOrganization.update({
      where: { organization_id: id },
      data: { is_verified: false },
    });
  }

  async findAllUsers(query: {
    page?: number;
    limit?: number;
    role?: string;
    organization_id?: string;
    search?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const where: any = {};

    if (query.organization_id) {
      where.organization_id = query.organization_id;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }

    if (query.role === 'staff') {
      const [items, total] = await Promise.all([
        this.prisma.staffAccount.findMany({
          where: { ...where, role: 'STAFF' },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            staff_id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            organization_name: true,
            createdAt: true,
          },
        }),
        this.prisma.staffAccount.count({ where: { ...where, role: 'STAFF' } }),
      ]);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    if (query.role === 'issuer') {
      const [items, total] = await Promise.all([
        this.prisma.staffAccount.findMany({
          where: { ...where, role: 'ISSUER' },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            staff_id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            organization_name: true,
            createdAt: true,
          },
        }),
        this.prisma.staffAccount.count({ where: { ...where, role: 'ISSUER' } }),
      ]);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    if (query.role === 'student') {
      const [items, total] = await Promise.all([
        this.prisma.studentAccount.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            student_id: true,
            student_fullName: true,
            email: true,
            status: true,
            organization_name: true,
            createdAt: true,
          },
        }),
        this.prisma.studentAccount.count({ where }),
      ]);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // Default: return staff (both ISSUER and STAFF roles)
    const [items, total] = await Promise.all([
      this.prisma.staffAccount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          staff_id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          organization_name: true,
          createdAt: true,
        },
      }),
      this.prisma.staffAccount.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findAllAuditLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    search?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const where: any = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.search) {
      where.OR = [
        { actorName: { contains: query.search } },
        { targetType: { contains: query.search } },
        { targetId: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ==================== Wallet Management ====================

  async getOrgWalletInfo(organizationId: string) {
    const org = await this.prisma.issuingOrganization.findUnique({
      where: { organization_id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    let balance = '0';
    let isAuthorized = false;

    if (org.wallet_address && this.blockchainService.isInitialized()) {
      balance = await this.blockchainService.getOrgBalance(org.wallet_address);
      isAuthorized = await this.blockchainService.isAuthorizedIssuer(org.wallet_address);
    }

    return {
      organization_id: org.organization_id,
      organization_name: org.organization_name,
      wallet_address: org.wallet_address,
      balance,
      is_authorized: isAuthorized,
      has_private_key: !!org.encrypted_private_key,
    };
  }

  async fundOrgWallet(organizationId: string, amount: string) {
    const org = await this.prisma.issuingOrganization.findUnique({
      where: { organization_id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.wallet_address) {
      throw new InternalServerErrorException('Organization has no wallet address');
    }

    const result = await this.blockchainService.fundOrgWallet(
      org.wallet_address,
      amount,
    );

    return {
      message: `Sent ${amount} ETH to ${org.organization_name}`,
      transactionHash: result.transactionHash,
      to: org.wallet_address,
      amount,
    };
  }

  async deauthorizeOrg(organizationId: string) {
    const org = await this.prisma.issuingOrganization.findUnique({
      where: { organization_id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.wallet_address) {
      throw new InternalServerErrorException('Organization has no wallet address');
    }

    const result = await this.blockchainService.deauthorizeIssuer(org.wallet_address);

    this.logger.log(`Deauthorized org ${org.organization_name} (${org.wallet_address})`);

    return {
      message: `Deauthorized ${org.organization_name} on blockchain`,
      transactionHash: result.transactionHash,
      wallet_address: org.wallet_address,
    };
  }

  async reauthorizeOrg(organizationId: string) {
    const org = await this.prisma.issuingOrganization.findUnique({
      where: { organization_id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.wallet_address) {
      throw new InternalServerErrorException('Organization has no wallet address');
    }

    const result = await this.blockchainService.authorizeIssuer(org.wallet_address);

    this.logger.log(`Re-authorized org ${org.organization_name} (${org.wallet_address})`);

    return {
      message: `Re-authorized ${org.organization_name} on blockchain`,
      transactionHash: result.transactionHash,
      wallet_address: org.wallet_address,
    };
  }

  async getWalletsOverview() {
    const orgs = await this.prisma.issuingOrganization.findMany({
      select: {
        organization_id: true,
        organization_name: true,
        wallet_address: true,
        encrypted_private_key: true,
        is_verified: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const items = await Promise.all(
      orgs.map(async (org) => {
        let balance = '0';
        let isAuthorized = false;
        if (org.wallet_address && this.blockchainService.isInitialized()) {
          try {
            balance = await this.blockchainService.getOrgBalance(org.wallet_address);
            isAuthorized = await this.blockchainService.isAuthorizedIssuer(org.wallet_address);
          } catch {}
        }
        return {
          organization_id: org.organization_id,
          organization_name: org.organization_name,
          wallet_address: org.wallet_address || 'Chưa thiết lập',
          balance,
          is_authorized: isAuthorized,
          has_wallet: !!org.wallet_address,
          is_verified: org.is_verified,
          created_at: org.created_at,
        };
      }),
    );

    return { items, total: items.length };
  }
  // ==================== Certificate Management ====================

  async findAllCertificates(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    organization_id?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.organization_id) {
      where.organization_id = query.organization_id;
    }

    if (query.search) {
      where.OR = [
        { certificate_title: { contains: query.search } },
        { student_fullName: { contains: query.search } },
        { serialNumber: { contains: query.search } },
        { organization_name: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.certificate.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          certificate_id: true,
          certificate_title: true,
          student_fullName: true,
          organization_name: true,
          status: true,
          serialNumber: true,
          registryNumber: true,
          ipfs_cid: true,
          tx_hash: true,
          block_number: true,
          issuedAt: true,
          revokedAt: true,
          revokeReason: true,
        },
      }),
      this.prisma.certificate.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findCertificateById(id: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificate_id: id },
    });
    if (!cert) return null;
    return cert;
  }

  async getCertificateStats() {
    // Status distribution
    const [draft, pending, issued, revoked, revokeFailed, total] =
      await Promise.all([
        this.prisma.certificate.count({ where: { status: 'DRAFT' } }),
        this.prisma.certificate.count({ where: { status: 'PENDING' } }),
        this.prisma.certificate.count({ where: { status: 'ISSUED' } }),
        this.prisma.certificate.count({ where: { status: 'REVOKED' } }),
        this.prisma.certificate.count({ where: { status: 'REVOKE_FAILED' } }),
        this.prisma.certificate.count(),
      ]);

    // Monthly issuance (last 12 months)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const issuedCerts = await this.prisma.certificate.findMany({
      where: {
        status: { in: ['ISSUED', 'REVOKED'] },
        issuedAt: { gte: twelveMonthsAgo },
      },
      select: { issuedAt: true, status: true },
    });

    const revokedCerts = await this.prisma.certificate.findMany({
      where: {
        status: 'REVOKED',
        revokedAt: { gte: twelveMonthsAgo },
      },
      select: { revokedAt: true },
    });

    const monthlyIssued: Record<string, number> = {};
    const monthlyRevoked: Record<string, number> = {};

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyIssued[key] = 0;
      monthlyRevoked[key] = 0;
    }

    for (const c of issuedCerts) {
      if (c.issuedAt) {
        const key = `${c.issuedAt.getFullYear()}-${String(c.issuedAt.getMonth() + 1).padStart(2, '0')}`;
        if (key in monthlyIssued) monthlyIssued[key]++;
      }
    }

    for (const c of revokedCerts) {
      if (c.revokedAt) {
        const key = `${c.revokedAt.getFullYear()}-${String(c.revokedAt.getMonth() + 1).padStart(2, '0')}`;
        if (key in monthlyRevoked) monthlyRevoked[key]++;
      }
    }

    const monthly = Object.keys(monthlyIssued).map((month) => ({
      month,
      issued: monthlyIssued[month],
      revoked: monthlyRevoked[month],
    }));

    // Top organizations by certificates
    const orgCounts = await this.prisma.certificate.groupBy({
      by: ['organization_id', 'organization_name'],
      _count: { certificate_id: true },
      orderBy: { _count: { certificate_id: 'desc' } },
      take: 5,
    });

    const topOrganizations = orgCounts.map((o) => ({
      organization_id: o.organization_id,
      organization_name: o.organization_name,
      count: o._count.certificate_id,
    }));

    return {
      statusDistribution: { draft, pending, issued, revoked, revokeFailed, total },
      monthly,
      topOrganizations,
    };
  }

  // ==================== System Health & Activity ====================

  async getSystemHealth() {
    const blockchain = await this.blockchainService.getHealth();
    return { blockchain };
  }

  async getRecentActivity(limitCount = 10) {
    // Merge: recent orgs, recent certs, recent audit logs
    const [recentOrgs, recentCerts, recentAudits] = await Promise.all([
      this.prisma.issuingOrganization.findMany({
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { organization_id: true, organization_name: true, is_verified: true, created_at: true },
      }),
      this.prisma.certificate.findMany({
        orderBy: { issuedAt: 'desc' },
        take: 5,
        where: { status: { in: ['ISSUED', 'REVOKED'] } },
        select: {
          certificate_id: true,
          certificate_title: true,
          organization_name: true,
          status: true,
          issuedAt: true,
          revokedAt: true,
        },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, action: true, actorName: true, targetType: true, createdAt: true },
      }),
    ]);

    type Activity = { type: string; title: string; subtitle: string; timestamp: Date };
    const activities: Activity[] = [];

    for (const org of recentOrgs) {
      activities.push({
        type: 'org_registered',
        title: `Tổ chức mới: ${org.organization_name}`,
        subtitle: org.is_verified ? 'Đã xác minh' : 'Chờ duyệt',
        timestamp: org.created_at,
      });
    }

    for (const cert of recentCerts) {
      activities.push({
        type: cert.status === 'REVOKED' ? 'cert_revoked' : 'cert_issued',
        title: `${cert.status === 'REVOKED' ? 'Thu hồi' : 'Cấp phát'}: ${cert.certificate_title}`,
        subtitle: cert.organization_name,
        timestamp: cert.status === 'REVOKED' && cert.revokedAt ? cert.revokedAt : cert.issuedAt,
      });
    }

    for (const log of recentAudits) {
      activities.push({
        type: 'audit',
        title: `${log.action}`,
        subtitle: `bởi ${log.actorName || 'Hệ thống'} — ${log.targetType}`,
        timestamp: log.createdAt,
      });
    }

    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return activities.slice(0, limitCount);
  }

  // ==================== User Management Nâng cao ====================

  async findUserById(id: string) {
    // 1. Check StaffAccount
    const staff = await this.prisma.staffAccount.findUnique({
      where: { staff_id: id },
      select: {
        staff_id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        organization_id: true,
        organization_name: true,
        createdAt: true,
      },
    });

    if (staff) {
      return { ...staff, type: 'staff' };
    }

    // 2. Check StudentAccount
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: id },
      select: {
        student_id: true,
        student_fullName: true,
        email: true,
        status: true,
        organization_id: true,
        organization_name: true,
        createdAt: true,
      },
    });

    if (student) {
      return {
        staff_id: student.student_id,
        name: student.student_fullName,
        email: student.email,
        role: 'STUDENT',
        status: student.status,
        organization_id: student.organization_id,
        organization_name: student.organization_name,
        createdAt: student.createdAt,
        type: 'student',
      };
    }

    throw new NotFoundException('User not found in the system');
  }

  async updateUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
    // Check if staff
    const staff = await this.prisma.staffAccount.findUnique({ where: { staff_id: id } });
    if (staff) {
      return this.prisma.staffAccount.update({
        where: { staff_id: id },
        data: { status },
      });
    }

    // Check if student
    const student = await this.prisma.studentAccount.findUnique({ where: { student_id: id } });
    if (student) {
      return this.prisma.studentAccount.update({
        where: { student_id: id },
        data: { status },
      });
    }

    throw new NotFoundException('User not found');
  }

  async resetUserPassword(id: string, newPassword?: string) {
    const passwordToUse = newPassword || 'Password123!';
    const hashedPassword = await bcrypt.hash(passwordToUse, 12);

    // Check if staff
    const staff = await this.prisma.staffAccount.findUnique({ where: { staff_id: id } });
    if (staff) {
      await this.prisma.staffAccount.update({
        where: { staff_id: id },
        data: { password: hashedPassword },
      });
      return { message: 'Reset password thành công', defaultPassword: passwordToUse };
    }

    // Check if student
    const student = await this.prisma.studentAccount.findUnique({ where: { student_id: id } });
    if (student) {
      await this.prisma.studentAccount.update({
        where: { student_id: id },
        data: { password: hashedPassword },
      });
      return { message: 'Reset password thành công', defaultPassword: passwordToUse };
    }

    throw new NotFoundException('User not found');
  }

  // ==================== Super Admin CRUD ====================

  async createSuperAdmin(data: { name: string; email: string; password?: string }) {
    const existing = await this.prisma.superAdmin.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const defaultPassword = data.password || 'Password123!';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    const created = await this.prisma.superAdmin.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        status: 'ACTIVE',
      },
    });

    const { password, ...result } = created;
    return { ...result, defaultPassword };
  }

  async listSuperAdmins() {
    return this.prisma.superAdmin.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        admin_id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
      },
    });
  }

  // ==================== Infrastructure Monitoring ====================

  async getDetailedBlockchainOverview() {
    const health = await this.blockchainService.getHealth();
    
    // Fetch recent block numbers, gas pricing etc.
    let recentBlocks: any[] = [];
    if (this.blockchainService.provider && health.connected) {
      try {
        const latest = health.blockNumber || 0;
        const blockPromises: any[] = [];
        for (let i = 0; i < Math.min(latest, 5); i++) {
          blockPromises.push(this.blockchainService.provider.getBlock(latest - i));
        }
        const blocks = await Promise.all(blockPromises);
        recentBlocks = blocks.filter(Boolean).map((b: any) => ({
          number: b.number,
          hash: b.hash,
          timestamp: new Date(Number(b.timestamp) * 1000).toISOString(),
          transactionsCount: b.transactions?.length ?? 0,
          gasUsed: b.gasUsed ? b.gasUsed.toString() : '0',
        }));
      } catch (err) {
        this.logger.warn(`Failed to fetch recent blocks: ${err.message}`);
      }
    }

    return {
      ...health,
      rpcUrl: process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL || 'http://127.0.0.1:8545',
      recentBlocks,
    };
  }

  async getDetailedIpfsOverview() {
    const health = await this.ipfsService.getHealth();
    
    // Count CIDs in database
    const totalCids = await this.prisma.certificate.count({
      where: { ipfs_cid: { not: null } }
    });

    return {
      ...health,
      totalCids,
      pinataJwtConfigured: !!process.env.PINATA_JWT,
      pinataApiKeyConfigured: !!process.env.PINATA_API_KEY,
    };
  }

  async getDetailedContractInfo() {
    const contractAddress = this.blockchainService.contractAddress;
    let owner = '—';
    let isInitialized = this.blockchainService.isInitialized();

    if (isInitialized && this.blockchainService.adminContract) {
      try {
        owner = await this.blockchainService.adminContract.owner();
      } catch (err) {
        this.logger.warn(`Failed to fetch contract owner: ${err.message}`);
      }
    }

    return {
      contractAddress,
      owner,
      isInitialized,
    };
  }

  // ==================== System Configuration ====================

  async getSystemConfig() {
    const configs = await this.prisma.systemConfig.findMany();
    
    // Map array to key-value object
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.config_key] = c.config_value;
    }

    // Default fallbacks
    const defaults = {
      system_name: 'CertiChain',
      system_logo: '',
      contact_email: 'support@certichain.vn',
      session_timeout: '60',
      allow_self_register: 'true',
      email_verification_required: 'false',
    };

    return {
      ...defaults,
      ...configMap,
    };
  }

  async updateSystemConfig(data: Record<string, string>) {
    const promises = Object.entries(data).map(([key, value]) => {
      return this.prisma.systemConfig.upsert({
        where: { config_key: key },
        update: { config_value: String(value) },
        create: { config_key: key, config_value: String(value) },
      });
    });

    await Promise.all(promises);
    return this.getSystemConfig();
  }

  // ==================== Export Data (CSV) ====================

  async exportOrganizationsCsv(): Promise<string> {
    const orgs = await this.prisma.issuingOrganization.findMany({
      orderBy: { created_at: 'desc' },
    });

    const headers = 'ID,Tên tổ chức,Email liên hệ,Địa chỉ ví,Trạng thái duyệt,Ngày tạo\n';
    const rows = orgs.map(o => {
      const status = o.is_verified ? 'Đã duyệt' : 'Chờ duyệt';
      const date = o.created_at.toISOString();
      return `"${o.organization_id}","${o.organization_name}","${o.contact_email}","${o.wallet_address || ''}","${status}","${date}"`;
    }).join('\n');

    return '\ufeff' + headers + rows;
  }

  async exportCertificatesCsv(): Promise<string> {
    const certs = await this.prisma.certificate.findMany({
      orderBy: { issuedAt: 'desc' },
    });

    const headers = 'ID,Tiêu đề văn bằng,Họ tên sinh viên,Tổ chức cấp,Số hiệu,Số vào sổ,Trạng thái,Mã IPFS,Tx Hash,Ngày cấp\n';
    const rows = certs.map(c => {
      const date = c.issuedAt ? c.issuedAt.toISOString() : '';
      return `"${c.certificate_id}","${c.certificate_title}","${c.student_fullName}","${c.organization_name}","${c.serialNumber || ''}","${c.registryNumber || ''}","${c.status}","${c.ipfs_cid || ''}","${c.tx_hash || ''}","${date}"`;
    }).join('\n');

    return '\ufeff' + headers + rows;
  }

  async exportUsersCsv(): Promise<string> {
    // Fetch all staff accounts
    const staff = await this.prisma.staffAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Fetch all student accounts
    const students = await this.prisma.studentAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const headers = 'ID,Họ tên,Email,Tổ chức trực thuộc,Vai trò,Trạng thái,Ngày tạo\n';
    
    const staffRows = staff.map(s => {
      const date = s.createdAt.toISOString();
      return `"${s.staff_id}","${s.name}","${s.email}","${s.organization_name}","${s.role}","${s.status}","${date}"`;
    });

    const studentRows = students.map(s => {
      const date = s.createdAt.toISOString();
      return `"${s.student_id}","${s.student_fullName}","${s.email}","${s.organization_name}","STUDENT","${s.status}","${date}"`;
    });

    const rows = [...staffRows, ...studentRows].join('\n');

    return '\ufeff' + headers + rows;
  }
}

