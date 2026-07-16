import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CertificateService } from '../certificate/certificate.service';
import { CreateCertificateDto } from '../certificate/dto/certificate.dto';

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificates: CertificateService,
    private readonly audit: AuditService,
  ) {}

  async create(
    organizationId: string,
    actor: { id: string; name: string },
    name: string,
    rows: CreateCertificateDto[],
  ) {
    const batch = await this.prisma.issuanceBatch.create({
      data: {
        organization_id: organizationId,
        name: name.trim(),
        totalRows: rows.length,
        createdById: actor.id,
        createdByName: actor.name,
        items: {
          create: rows.map((row, index) => ({
            rowNumber: index + 2,
            input: row as any,
          })),
        },
      },
      include: { items: { orderBy: { rowNumber: 'asc' } } },
    });

    for (const item of batch.items) {
      await this.processItem(item, organizationId, actor);
    }
    const completed = await this.refreshTotals(batch.id);
    await this.audit.log({
      organizationId,
      actorId: actor.id,
      actorName: actor.name,
      action: 'CREATE_ISSUANCE_BATCH',
      targetType: 'ISSUANCE_BATCH',
      targetId: batch.id,
      success: completed.failedRows === 0,
      details: {
        totalRows: completed.totalRows,
        successRows: completed.successRows,
        failedRows: completed.failedRows,
      },
    });
    return this.findOne(batch.id, organizationId);
  }

  async findAll(organizationId: string) {
    return this.prisma.issuanceBatch.findMany({
      where: { organization_id: organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, organizationId: string) {
    const batch = await this.prisma.issuanceBatch.findFirst({
      where: { id, organization_id: organizationId },
      include: { items: { orderBy: { rowNumber: 'asc' } } },
    });
    if (!batch) throw new NotFoundException('Issuance batch not found');
    return batch;
  }

  async retryItem(
    batchId: string,
    itemId: string,
    organizationId: string,
    actor: { id: string; name: string },
  ) {
    await this.findOne(batchId, organizationId);
    const item = await this.prisma.issuanceBatchItem.findFirst({
      where: { id: itemId, batchId },
    });
    if (!item) throw new NotFoundException('Batch row not found');
    if (item.status !== 'FAILED') {
      throw new BadRequestException('Only failed rows can be retried');
    }
    await this.processItem(item, organizationId, actor);
    await this.refreshTotals(batchId);
    return this.findOne(batchId, organizationId);
  }

  private async processItem(
    item: any,
    organizationId: string,
    actor: { id: string; name: string },
  ) {
    await this.prisma.issuanceBatchItem.update({
      where: { id: item.id },
      data: { status: 'PROCESSING', error: null },
    });
    try {
      let certificateId = item.certificateId as string | null;
      if (!certificateId) {
        const draft = await this.certificates.createDraft(
          organizationId,
          item.input,
          actor,
        );
        certificateId = draft.certificate_id;
        await this.prisma.issuanceBatchItem.update({
          where: { id: item.id },
          data: { certificateId },
        });
      }
      const certificate = await this.certificates.findOne(
        certificateId,
        organizationId,
      );
      if (certificate.status === 'DRAFT') {
        await this.certificates.update(certificateId, organizationId, {
          status: 'PENDING',
        });
      }
      if (certificate.status !== 'ISSUED') {
        await this.certificates.approve(certificateId, organizationId, actor);
      }
      await this.prisma.issuanceBatchItem.update({
        where: { id: item.id },
        data: { status: 'SUCCESS', error: null, certificateId },
      });
    } catch (error) {
      await this.prisma.issuanceBatchItem.update({
        where: { id: item.id },
        data: {
          status: 'FAILED',
          error: String(
            error?.message || 'Unknown batch processing error',
          ).slice(0, 2000),
        },
      });
    }
  }

  private async refreshTotals(batchId: string) {
    const [successRows, failedRows, totalRows] = await Promise.all([
      this.prisma.issuanceBatchItem.count({
        where: { batchId, status: 'SUCCESS' },
      }),
      this.prisma.issuanceBatchItem.count({
        where: { batchId, status: 'FAILED' },
      }),
      this.prisma.issuanceBatchItem.count({ where: { batchId } }),
    ]);
    return this.prisma.issuanceBatch.update({
      where: { id: batchId },
      data: {
        successRows,
        failedRows,
        totalRows,
        status:
          failedRows === 0
            ? 'COMPLETED'
            : successRows === 0
              ? 'FAILED'
              : 'PARTIAL',
        completedAt: new Date(),
      },
    });
  }
}
