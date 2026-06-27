import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OcrModule } from './modules/ocr/ocr.module';
import { IpfsModule } from './modules/ipfs/ipfs.module';
import { BlockchainModule } from './core/blockchain/blockchain.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './core/database/database.module';
import { PrismaModule } from './core/prisma/prisma.module';
import { CertificateModule } from './modules/certificate/certificate.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    PrismaModule,
    OcrModule,
    AuthModule,
    CertificateModule,
    IpfsModule,
    BlockchainModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
