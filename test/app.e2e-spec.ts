import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const testEmail = `test_${Date.now()}@school.edu.vn`;
  const testPassword = 'StrongP@ss1';
  const testName = 'Trường THPT Thực Nghiệm';
  let accessToken: string;

  describe('POST /auth/register', () => {
    it('should register a new organization (issuer) successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: testEmail, name: testName, password: testPassword })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email', testEmail);
      expect(res.body).toHaveProperty('name', testName);
      expect(res.body).toHaveProperty('role', 'issuer');
      expect(res.body).toHaveProperty('accessToken');
      accessToken = res.body.accessToken;
    });

    it('should reject duplicate email registration', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: testEmail, name: testName, password: testPassword })
        .expect(409);
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'invalid', name: testName, password: testPassword })
        .expect(400);
    });

    it('should reject weak password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'weak@test.com', name: testName, password: 'short' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email', testEmail);
      expect(res.body).toHaveProperty('role', 'issuer');
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject invalid password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testEmail, password: 'WrongPass1' })
        .expect(401);
    });

    it('should reject non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: testPassword })
        .expect(401);
    });

    it('should reject empty body', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });
  });
});
