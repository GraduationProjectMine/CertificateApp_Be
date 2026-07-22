import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';
import { IpfsModule } from '../ipfs/ipfs.module';
import { BlockchainModule } from '../../core/blockchain/blockchain.module';
import { CryptoModule } from '../../core/crypto/crypto.module';

@Module({
  imports: [IpfsModule, BlockchainModule, CryptoModule],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
