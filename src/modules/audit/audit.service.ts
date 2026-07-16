import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface CreateAuditLogInput {
  organizationId: string;
  actorId?: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: CreateAuditLogInput) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          organization_id: input.organizationId,
          actorId: input.actorId,
          actorName: input.actorName,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent?.slice(0, 500),
          success: input.success,
          details: input.details as any,
        },
      });
    } catch (error) {
      this.logger.warn(`Could not persist audit event ${input.action}: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }

  async findAll(
    organizationId: string,
    query: {
      page?: number;
      limit?: number;
      action?: string;
      actor?: string;
      search?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {
      organization_id: organizationId,
      ...(query.action && { action: query.action }),
      ...(query.actor && {
        OR: [
          { actorId: query.actor },
          { actorName: { contains: query.actor } },
        ],
      }),
      ...(query.search && {
        OR: [
          { targetId: { contains: query.search } },
          { action: { contains: query.search } },
          { actorName: { contains: query.search } },
        ],
      }),
      ...((query.fromDate || query.toDate) && {
        createdAt: {
          ...(query.fromDate && { gte: new Date(query.fromDate) }),
          ...(query.toDate && { lte: new Date(query.toDate) }),
        },
      }),
    };

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
