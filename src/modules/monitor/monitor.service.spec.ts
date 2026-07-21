import { MonitorService } from './monitor.service';

describe('MonitorService', () => {
  it('combines safe infrastructure health with recent issue and revoke transactions', async () => {
    const prisma = {
      certificate: {
        findMany: jest.fn().mockResolvedValue([
          {
            certificate_id: 'cert-1',
            serialNumber: 'SH001',
            issuedAt: new Date('2024-01-01'),
            revokedAt: new Date('2024-02-01'),
            status: 'REVOKED',
            tx_hash: '0xissue',
            block_number: 10,
            gas_used: '100',
            revoke_tx_hash: '0xrevoke',
            revoke_block_number: 12,
            ipfs_cid: 'bafy1',
          },
        ]),
        count: jest
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1),
      },
    } as any;
    const blockchain = {
      getHealth: jest
        .fn()
        .mockResolvedValue({ connected: true, walletAddress: '0xpublic' }),
    } as any;
    const ipfs = {
      getHealth: jest.fn().mockResolvedValue({
        connected: true,
        gateway: 'https://gateway.pinata.cloud',
      }),
    } as any;
    const service = new MonitorService(prisma, blockchain, ipfs);

    const result = await service.getOverview('org-1');

    expect(result.transactions.map((tx) => tx.action)).toEqual([
      'REVOKE',
      'ISSUE',
    ]);
    expect(result.totals.cids).toBe(1);
    expect(result.totals.transactions).toBe(2);
    expect(JSON.stringify(result)).not.toContain('privateKey');
  });
});
