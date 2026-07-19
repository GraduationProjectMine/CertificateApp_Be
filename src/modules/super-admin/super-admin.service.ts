import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

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
}
