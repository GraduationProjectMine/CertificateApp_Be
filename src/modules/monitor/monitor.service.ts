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
      onlineCertificates,
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
        take: 50,
        select: {
          certificate_id: true,
          serialNumber: true,
          certificate_title: true,
          student_fullName: true,
          organization_name: true,
          issuedAt: true,
          revokedAt: true,
          status: true,
          tx_hash: true,
          block_number: true,
          gas_used: true,
          revoke_tx_hash: true,
          revoke_block_number: true,
          ipfs_cid: true,
          organization: {
            select: {
              organization_name: true,
              wallet_address: true,
              contact_email: true,
            },
          },
        },
      }),
      this.prisma.onlineCertificate.findMany({
        where: {
          ...whereCert,
          tx_hash: { not: null },
        },
        orderBy: { issuedAt: 'desc' },
        take: 50,
        select: {
          certificate_id: true,
          serialNumber: true,
          certificate_title: true,
          student_fullName: true,
          organization_name: true,
          issuedAt: true,
          status: true,
          tx_hash: true,
          block_number: true,
          gas_used: true,
          ipfs_cid: true,
          organization: {
            select: {
              organization_name: true,
              wallet_address: true,
              contact_email: true,
            },
          },
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

    const transactions: any[] = [];

    // Parse regular certificates
    for (const cert of certificates) {
      if (cert.revoke_tx_hash || cert.status === 'REVOKE_FAILED') {
        transactions.push({
          timestamp: cert.revokedAt,
          certificateId: cert.certificate_id,
          certificateCode: cert.serialNumber,
          certificateTitle: cert.certificate_title,
          studentName: cert.student_fullName,
          organizationName:
            cert.organization_name || cert.organization?.organization_name,
          creatorAddress: cert.organization?.wallet_address,
          action: 'REVOKE',
          transactionHash: cert.revoke_tx_hash,
          blockNumber: cert.revoke_block_number,
          gasUsed: null,
          status: cert.status === 'REVOKE_FAILED' ? 'FAILED' : 'SUCCESS',
        });
      }
      if (cert.tx_hash) {
        transactions.push({
          timestamp: cert.issuedAt,
          certificateId: cert.certificate_id,
          certificateCode: cert.serialNumber,
          certificateTitle: cert.certificate_title,
          studentName: cert.student_fullName,
          organizationName:
            cert.organization_name || cert.organization?.organization_name,
          creatorAddress: cert.organization?.wallet_address,
          action: 'ISSUE',
          transactionHash: cert.tx_hash,
          blockNumber: cert.block_number,
          gasUsed: cert.gas_used,
          status: 'SUCCESS',
        });
      }
    }

    // Parse online certificates
    for (const oc of onlineCertificates) {
      if (oc.tx_hash) {
        transactions.push({
          timestamp: oc.issuedAt,
          certificateId: oc.certificate_id,
          certificateCode: oc.serialNumber,
          certificateTitle: oc.certificate_title,
          studentName: oc.student_fullName,
          organizationName:
            oc.organization_name || oc.organization?.organization_name,
          creatorAddress: oc.organization?.wallet_address,
          action: 'ISSUE',
          transactionHash: oc.tx_hash,
          blockNumber: oc.block_number,
          gasUsed: oc.gas_used,
          status: 'SUCCESS',
        });
      }
    }

    // Deduplicate by tx_hash if needed and sort descending
    const seenTx = new Set<string>();
    const sortedTransactions = transactions
      .filter((tx) => {
        if (!tx.transactionHash) return true;
        if (seenTx.has(tx.transactionHash)) return false;
        seenTx.add(tx.transactionHash);
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp || 0).getTime() -
          new Date(a.timestamp || 0).getTime(),
      )
      .slice(0, 50);

    const allCids = [
      ...certificates
        .filter((c) => c.ipfs_cid)
        .map((c) => ({
          certificateId: c.certificate_id,
          certificateCode: c.serialNumber,
          cid: c.ipfs_cid!,
          createdAt: c.issuedAt,
        })),
      ...onlineCertificates
        .filter((oc) => oc.ipfs_cid)
        .map((oc) => ({
          certificateId: oc.certificate_id,
          certificateCode: oc.serialNumber,
          cid: oc.ipfs_cid!,
          createdAt: oc.issuedAt,
        })),
    ].slice(0, 30);

    return {
      blockchain: chain,
      ipfs,
      totals: {
        transactions:
          issuedTransactions + revokedTransactions + onlineCertificates.length,
        cids: totalCids,
        failedTransactions,
      },
      transactions: sortedTransactions,
      cids: allCids,
    };
  }
}
