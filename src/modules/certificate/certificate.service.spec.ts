import { BadRequestException } from '@nestjs/common';
import { CertificateService } from './certificate.service';

describe('CertificateService revoke', () => {
  const certificate = {
    certificate_id: 'cert-1',
    organization_id: 'org-1',
    status: 'ISSUED',
    certificate_title: 'Bang cu nhan',
    student_fullName: 'Nguyen Van A',
    dob: '2000-01-01',
    placeOfBirth: 'Ha Noi',
    gender: 'Nam',
    ethnicity: 'Kinh',
    schoolName: 'Dai hoc A',
    examCohort: '2024',
    examBoard: 'Hoi dong A',
    issueLocation: 'Ha Noi',
    issueDate: '2024-06-01',
    serialNumber: 'SH001',
    registryNumber: 'VS001',
  };

  const prisma = {
    certificate: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;
  const ipfs = {
    calculateSha3Hash: jest.fn().mockReturnValue('a'.repeat(64)),
  } as any;
  const blockchain = {
    isInitialized: jest.fn().mockReturnValue(true),
    revokeCertificate: jest.fn().mockResolvedValue({
      transactionHash: '0xrevoke',
      blockNumber: 42,
    }),
    getCertificate: jest.fn(),
  } as any;
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

  beforeEach(() => jest.clearAllMocks());

  it('revokes on-chain, persists metadata and writes an audit event', async () => {
    prisma.certificate.findUnique.mockResolvedValue(certificate);
    prisma.certificate.update.mockResolvedValue({
      ...certificate,
      status: 'REVOKED',
    });
    const service = new CertificateService(prisma, ipfs, blockchain, audit);

    const result = await service.revoke(
      'cert-1',
      'org-1',
      'actor-1',
      'Sai thong tin sinh vien',
    );

    expect(blockchain.revokeCertificate).toHaveBeenCalledWith('a'.repeat(64));
    expect(prisma.certificate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REVOKED',
          revokeReason: 'Sai thong tin sinh vien',
          revoke_tx_hash: '0xrevoke',
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REVOKE_CERTIFICATE', success: true }),
    );
    expect(result.status).toBe('REVOKED');
  });

  it('refuses to revoke a certificate that is not issued', async () => {
    prisma.certificate.findUnique.mockResolvedValue({
      ...certificate,
      status: 'DRAFT',
    });
    const service = new CertificateService(prisma, ipfs, blockchain, audit);

    await expect(
      service.revoke('cert-1', 'org-1', 'actor-1', 'Ly do hop le'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(blockchain.revokeCertificate).not.toHaveBeenCalled();
  });

  it('recovers a failed local revocation when blockchain is already revoked', async () => {
    prisma.certificate.findUnique.mockResolvedValue({
      ...certificate,
      status: 'REVOKE_FAILED',
      revokeReason: 'Sai thong tin sinh vien',
      revokedAt: null,
    });
    prisma.certificate.update.mockResolvedValue({
      ...certificate,
      status: 'REVOKED',
    });
    blockchain.getCertificate.mockResolvedValue({ isRevoked: true });
    const service = new CertificateService(prisma, ipfs, blockchain, audit);

    const result = await service.retryRevoke('cert-1', 'org-1', 'actor-1');

    expect(result.status).toBe('REVOKED');
    expect(blockchain.revokeCertificate).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ details: { recoveredFromBlockchain: true } }),
    );
  });
});
