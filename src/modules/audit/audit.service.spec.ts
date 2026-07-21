import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('scopes paginated logs to one organization', async () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;
    const service = new AuditService(prisma);

    const result = await service.findAll('org-1', {
      page: 2,
      limit: 10,
      action: 'REVOKE_CERTIFICATE',
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          action: 'REVOKE_CERTIFICATE',
        }),
        skip: 10,
        take: 10,
      }),
    );
    expect(result.page).toBe(2);
  });
});
