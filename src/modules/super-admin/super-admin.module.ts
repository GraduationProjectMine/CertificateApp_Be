import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { BlockchainModule } from '../../core/blockchain/blockchain.module';
import { CryptoModule } from '../../core/crypto/crypto.module';
import { IpfsModule } from '../ipfs/ipfs.module';

@Module({
  imports: [BlockchainModule, CryptoModule, IpfsModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
