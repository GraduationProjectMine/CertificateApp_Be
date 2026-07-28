import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Issue Certificate - Full Flow (e2e)', () => {
  let app: INestApplication;
  const timestamp = Date.now();
  const orgEmail = `test_org_${timestamp}@test.edu.vn`;
  const orgPassword = 'TestOrg@123';
  const orgName = `Test University ${timestamp}`;
  const studentEmail = `test_stu_${timestamp}@test.edu.vn`;
  const studentPassword = 'Student@123';
  const studentName = `Nguyen Van A ${timestamp}`;

  let issuerToken: string;
  let studentId: string;
  let certificateId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  // ── Step 1: Register issuer ──
  describe('Step 1: Register Issuer', () => {
    it('should register a new issuer organization', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: orgEmail, name: orgName, password: orgPassword })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('role', 'issuer');
      issuerToken = res.body.accessToken;
      console.log(`  Issuer registered: id=${res.body.id}`);
      console.log(`  Issuer email: ${orgEmail}`);
    }, 10000);
  });

  // ── Step 2: Create student ──
  describe('Step 2: Create Student', () => {
    it('should create a student under this organization', async () => {
      const res = await request(app.getHttpServer())
        .post('/issuer/students')
        .set('Authorization', `Bearer ${issuerToken}`)
        .send({
          name: studentName,
          email: studentEmail,
          password: studentPassword,
        })
        .expect(201);

      expect(res.body).toHaveProperty('student');
      studentId = res.body.student.student_id;
      console.log(`  Student created: id=${studentId}`);
      console.log(`  Student email: ${studentEmail}`);
    }, 10000);
  });

  // ── Step 3: Create certificate draft ──
  describe('Step 3: Create Certificate Draft', () => {
    it('should create a DRAFT certificate', async () => {
      const res = await request(app.getHttpServer())
        .post('/certificates/draft')
        .set('Authorization', `Bearer ${issuerToken}`)
        .send({
          student_id: studentId,
          certificate_title: 'BANG TOT NGHIEP THPT - TEST',
          dob: '15/05/2003',
          placeOfBirth: 'Ha Noi',
          gender: 'Nam',
          ethnicity: 'Kinh',
          schoolName: 'THPT Chu Van An',
          examCohort: '2025',
          examBoard: 'So Giao duc va Dao tao Ha Noi',
          issueLocation: 'Ha Noi',
          issueDate: '15/06/2025',
          serialNumber: `TEST-${timestamp}`,
          registryNumber: `REG-${timestamp}`,
        })
        .expect(201);

      expect(res.body).toHaveProperty('certificate_id');
      expect(res.body.status).toBe('DRAFT');
      certificateId = res.body.certificate_id;
      console.log(`  Draft created: id=${certificateId}`);
      console.log(`  ipfs_cid: ${res.body.ipfs_cid}`);
      console.log(`  file_url: ${res.body.file_url}`);
    }, 10000);
  });

  // ── Step 4: Submit to PENDING ──
  describe('Step 4: Submit to PENDING', () => {
    it('should update status to PENDING', async () => {
      const res = await request(app.getHttpServer())
        .put(`/certificates/${certificateId}`)
        .set('Authorization', `Bearer ${issuerToken}`)
        .send({ status: 'PENDING' })
        .expect(200);

      expect(res.body.status).toBe('PENDING');
      console.log(`  Certificate status: ${res.body.status}`);
    }, 10000);
  });

  // ── Step 5: Approve (IPFS + Blockchain) ──
  describe('Step 5: Approve - Upload to IPFS + Blockchain', () => {
    it('should approve, upload JSON to IPFS, and register on blockchain', async () => {
      const res = await request(app.getHttpServer())
        .post(`/certificates/${certificateId}/approve`)
        .set('Authorization', `Bearer ${issuerToken}`)
        .expect(200);

      console.log('');
      console.log('  ========================================');
      console.log('  APPROVAL RESULT:');
      console.log('  ========================================');
      console.log(`  status:          ${res.body.status}`);
      console.log(`  ipfs_cid:        ${res.body.ipfs_cid}`);
      console.log(`  file_url:        ${res.body.file_url}`);
      console.log(`  tx_hash:         ${res.body.tx_hash}`);
      console.log(`  block_number:    ${res.body.block_number}`);
      console.log(`  gas_used:        ${res.body.gas_used}`);
      console.log('  ========================================');
      console.log('');
      console.log('  >>> CHECK THESE URLS MANUALLY <<<');
      console.log(`  Pinata Gateway:  https://gateway.pinata.cloud/ipfs/${res.body.ipfs_cid}`);
      console.log(`  ipfs.io:         https://ipfs.io/ipfs/${res.body.ipfs_cid}`);
      console.log('');

      expect(res.body.status).toBe('ISSUED');
      expect(res.body.ipfs_cid).toBeTruthy();
      expect(res.body.tx_hash).toBeTruthy();
      expect(res.body.ipfs_cid).not.toContain('bafk_pending');
    }, 60000);
  });

  // ── Step 6: Verify certificate exists ──
  describe('Step 6: Verify Certificate', () => {
    it('should return the ISSUED certificate with real CID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/certificates/${certificateId}`)
        .set('Authorization', `Bearer ${issuerToken}`)
        .expect(200);

      console.log('');
      console.log('  FINAL CERTIFICATE IN DB:');
      console.log(`  id:              ${res.body.certificate_id}`);
      console.log(`  status:          ${res.body.status}`);
      console.log(`  ipfs_cid:        ${res.body.ipfs_cid}`);
      console.log(`  file_url:        ${res.body.file_url}`);
      console.log(`  tx_hash:         ${res.body.tx_hash}`);
      console.log('');

      expect(res.body.status).toBe('ISSUED');
      expect(res.body.ipfs_cid).not.toContain('bafk_pending');
      expect(res.body.tx_hash).not.toBeNull();
    }, 10000);
  });
});
