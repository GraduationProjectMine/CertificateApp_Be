import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../../core/blockchain/blockchain.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { IpfsService } from '../ipfs/ipfs.service';

@Injectable()
export class MonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly ipfs: IpfsService,
  ) {}

  async getOverview(organizationId?: string) {
    const whereCert = organizationId ? { organization_id: organizationId } : {};
    const [
      chain,
      ipfs,
      certificates,
      totalCids,
      failedTransactions,
      issuedTransactions,
      revokedTransactions,
    ] = await Promise.all([
        this.blockchain.getHealth(),
        this.ipfs.getHealth(),
        this.prisma.certificate.findMany({
          where: {
            ...whereCert,
            OR: [
              { tx_hash: { not: null } },
              { revoke_tx_hash: { not: null } },
              { status: { in: ['REVOKE_FAILED'] } },
            ],
          },
          orderBy: { issuedAt: 'desc' },
          take: 20,
          select: {
            certificate_id: true,
            serialNumber: true,
            issuedAt: true,
            revokedAt: true,
            status: true,
            tx_hash: true,
            block_number: true,
            gas_used: true,
            revoke_tx_hash: true,
            revoke_block_number: true,
            ipfs_cid: true,
          },
        }),
        this.prisma.certificate.count({
          where: { ...whereCert, ipfs_cid: { not: null } },
        }),
        this.prisma.certificate.count({
          where: {
            ...whereCert,
            status: { in: ['REVOKE_FAILED'] },
          },
        }),
        this.prisma.certificate.count({
          where: { ...whereCert, tx_hash: { not: null } },
        }),
        this.prisma.certificate.count({
          where: {
            ...whereCert,
            revoke_tx_hash: { not: null },
          },
        }),
      ]);

    const transactions = certificates
      .flatMap((certificate) => {
        const result: any[] = [];
        if (
          certificate.revoke_tx_hash ||
          certificate.status === 'REVOKE_FAILED'
        ) {
          result.push({
            timestamp: certificate.revokedAt,
            certificateId: certificate.certificate_id,
            certificateCode: certificate.serialNumber,
            action: 'REVOKE',
            transactionHash: certificate.revoke_tx_hash,
            blockNumber: certificate.revoke_block_number,
            gasUsed: null,
            status:
              certificate.status === 'REVOKE_FAILED' ? 'FAILED' : 'SUCCESS',
          });
        }
        if (certificate.tx_hash) {
          result.push({
            timestamp: certificate.issuedAt,
            certificateId: certificate.certificate_id,
            certificateCode: certificate.serialNumber,
            action: 'ISSUE',
            transactionHash: certificate.tx_hash,
            blockNumber: certificate.block_number,
            gasUsed: certificate.gas_used,
            status: 'SUCCESS',
          });
        }
        return result;
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp || 0).getTime() -
          new Date(a.timestamp || 0).getTime(),
      )
      .slice(0, 20);

    return {
      blockchain: chain,
      ipfs,
      totals: {
        transactions: issuedTransactions + revokedTransactions,
        cids: totalCids,
        failedTransactions,
      },
      transactions,
      cids: certificates
        .filter((certificate) => certificate.ipfs_cid)
        .map((certificate) => ({
          certificateId: certificate.certificate_id,
          certificateCode: certificate.serialNumber,
          cid: certificate.ipfs_cid,
          createdAt: certificate.issuedAt,
        })),
    };
  }
}
