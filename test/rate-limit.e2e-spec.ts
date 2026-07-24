import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 429 Too Many Requests when rate limit is exceeded', async () => {
    // Short term limit is 10 requests per second
    const agent = request(app.getHttpServer());
    const responses = [];
    for (let i = 0; i < 15; i++) {
      responses.push(await agent.get('/'));
    }

    const status200Count = responses.filter((r) => r.status === 200).length;
    const status429Count = responses.filter((r) => r.status === 429).length;

    expect(status200Count).toBe(10);
    expect(status429Count).toBe(5);
  });
});
