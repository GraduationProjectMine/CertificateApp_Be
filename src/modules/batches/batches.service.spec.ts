import { BatchesService } from './batches.service';

describe('BatchesService', () => {
  const row = {
    student_id: 'student-1',
    certificate_title: 'Bang cu nhan',
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
  const item = {
    id: 'item-1',
    batchId: 'batch-1',
    rowNumber: 2,
    input: row,
    status: 'PENDING',
    certificateId: null,
  };
  const completed = {
    id: 'batch-1',
    name: 'Batch A',
    totalRows: 1,
    successRows: 1,
    failedRows: 0,
    items: [{ ...item, status: 'SUCCESS' }],
  };
  const prisma = {
    issuanceBatch: {
      create: jest
        .fn()
        .mockResolvedValue({ ...completed, successRows: 0, items: [item] }),
      update: jest.fn().mockResolvedValue(completed),
      findFirst: jest.fn().mockResolvedValue(completed),
      findMany: jest.fn(),
    },
    issuanceBatchItem: {
      update: jest.fn().mockResolvedValue(item),
      count: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(where.status === 'FAILED' ? 0 : 1),
        ),
      findFirst: jest.fn(),
    },
  } as any;
  const certificates = {
    createDraft: jest.fn().mockResolvedValue({ certificate_id: 'cert-1' }),
    findOne: jest
      .fn()
      .mockResolvedValue({ certificate_id: 'cert-1', status: 'DRAFT' }),
    update: jest.fn().mockResolvedValue({ status: 'PENDING' }),
    approve: jest.fn().mockResolvedValue({ status: 'ISSUED' }),
  } as any;
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

  beforeEach(() => jest.clearAllMocks());

  it('creates, issues and summarizes every imported row', async () => {
    const service = new BatchesService(prisma, certificates, audit);
    const result = await service.create(
      'org-1',
      { id: 'actor-1', name: 'Admin' },
      'Batch A',
      [row],
    );

    expect(certificates.createDraft).toHaveBeenCalled();
    expect(certificates.update).toHaveBeenCalledWith('cert-1', 'org-1', {
      status: 'PENDING',
    });
    expect(certificates.approve).toHaveBeenCalledWith('cert-1', 'org-1', {
      id: 'actor-1',
      name: 'Admin',
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_ISSUANCE_BATCH' }),
    );
    expect(result.successRows).toBe(1);
  });
});
