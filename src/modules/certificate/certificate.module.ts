import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';
import { IpfsModule } from '../ipfs/ipfs.module';
import { BlockchainModule } from '../../core/blockchain/blockchain.module';

@Module({
  imports: [IpfsModule, BlockchainModule],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
