import { Module } from '@nestjs/common';
import { BlockchainModule } from '../../core/blockchain/blockchain.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { MonitorController } from './monitor.controller';
import { MonitorService } from './monitor.service';

@Module({
  imports: [BlockchainModule, IpfsModule],
  controllers: [MonitorController],
  providers: [MonitorService],
})
export class MonitorModule {}
