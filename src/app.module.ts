import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
