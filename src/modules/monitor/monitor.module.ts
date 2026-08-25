import { Module } from '@nestjs/common';
import { BlockchainModule } from '../../core/blockchain/blockchain.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { IssuerModule } from '../issuer/issuer.module';
import { MonitorController } from './monitor.controller';
import { MonitorService } from './monitor.service';

@Module({
  imports: [BlockchainModule, IpfsModule, IssuerModule],
  controllers: [MonitorController],
  providers: [MonitorService],
})
export class MonitorModule {}
