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
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    onlineCertificate: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;
  const ipfs = {
    calculateSha3Hash: jest.fn().mockReturnValue('a'.repeat(64)),
    calculateOnlineCertSha3Hash: jest.fn().mockReturnValue('b'.repeat(64)),
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
    prisma.certificate.findFirst.mockResolvedValue(certificate);
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

  it('revokes online certificate using online cert SHA-3 hash', async () => {
    prisma.certificate.findFirst.mockResolvedValue(null);
    prisma.onlineCertificate.findFirst.mockResolvedValue(certificate);
    prisma.onlineCertificate.update.mockResolvedValue({
      ...certificate,
      status: 'REVOKED',
    });
    const service = new CertificateService(prisma, ipfs, blockchain, audit);

    const result = await service.revoke(
      'cert-1',
      'org-1',
      'actor-1',
      'Thu hoi bang truc tuyen hop le',
    );

    expect(ipfs.calculateOnlineCertSha3Hash).toHaveBeenCalledWith({
      documentTitle: certificate.certificate_title,
      fullName: certificate.student_fullName,
      serialNumber: certificate.serialNumber,
      registryNumber: certificate.registryNumber,
    });
    expect(blockchain.revokeCertificate).toHaveBeenCalledWith('b'.repeat(64));
    expect(prisma.onlineCertificate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REVOKED',
          revokeReason: 'Thu hoi bang truc tuyen hop le',
          revoke_tx_hash: '0xrevoke',
        }),
      }),
    );
    expect(result.status).toBe('REVOKED');
  });

  it('refuses to revoke a certificate that is not issued', async () => {
    prisma.certificate.findFirst.mockResolvedValue({
      ...certificate,
      status: 'DRAFT',
    });
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

  it('recovers a failed local revocation by retrying revoke process', async () => {
    const failedCert = {
      ...certificate,
      status: 'REVOKE_FAILED',
      revokeReason: 'Sai thong tin sinh vien',
      revokedAt: null,
    };
    prisma.certificate.findUnique.mockResolvedValue(failedCert);
    prisma.certificate.findFirst.mockResolvedValue(failedCert);
    prisma.certificate.update.mockResolvedValue({
      ...certificate,
      status: 'REVOKED',
    });
    const service = new CertificateService(prisma, ipfs, blockchain, audit);

    const result = await service.retryRevoke('cert-1', 'org-1', 'actor-1');

    expect(result.status).toBe('REVOKED');
    expect(blockchain.revokeCertificate).toHaveBeenCalledWith('a'.repeat(64));
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REVOKE_CERTIFICATE', success: true }),
    );
  });

  describe('createDraft validation', () => {
    it('throws BadRequestException if any required field is missing', async () => {
      const service = new CertificateService(prisma, ipfs, blockchain, audit);
      await expect(
        service.createDraft('org-1', {
          student_id: 'std-1',
          certificate_title: 'Bằng tốt nghiệp',
          // missing other required fields like dob, placeOfBirth, etc.
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
