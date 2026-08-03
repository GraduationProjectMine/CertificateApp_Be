import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OcrModule } from './modules/ocr/ocr.module';
import { IpfsModule } from './modules/ipfs/ipfs.module';
import { BlockchainModule } from './core/blockchain/blockchain.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './core/database/database.module';
import { CertificateModule } from './modules/certificate/certificate.module';
import { VerifierModule } from './modules/verifier/verifier.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { AuditModule } from './modules/audit/audit.module';
import { BatchesModule } from './modules/batches/batches.module';
import { MonitorModule } from './modules/monitor/monitor.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DisputeModule } from './modules/dispute/dispute.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'short',
          ttl: Number(config.get('THROTTLE_SHORT_TTL', 1000)),
          limit: Number(config.get('THROTTLE_SHORT_LIMIT', 10)),
        },
        {
          name: 'medium',
          ttl: Number(config.get('THROTTLE_MEDIUM_TTL', 60000)),
          limit: Number(config.get('THROTTLE_MEDIUM_LIMIT', 100)),
        },
        {
          name: 'long',
          ttl: Number(config.get('THROTTLE_LONG_TTL', 3600000)),
          limit: Number(config.get('THROTTLE_LONG_LIMIT', 1000)),
        },
      ],
    }),
    DatabaseModule,
    AuditModule,
    OcrModule,
    AuthModule,
    IpfsModule,
    BlockchainModule,
    CertificateModule,
    VerifierModule,
    TemplatesModule,
    BatchesModule,
    MonitorModule,
    NotificationsModule,
    DisputeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
