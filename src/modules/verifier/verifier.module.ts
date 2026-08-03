import { Module } from '@nestjs/common';
import { VerifierController } from './verifier.controller';
import { VerifierService } from './verifier.service';
import { BlockchainModule } from '../../core/blockchain/blockchain.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [BlockchainModule, IpfsModule, OcrModule],
  controllers: [VerifierController],
  providers: [VerifierService],
  exports: [VerifierService],
})
export class VerifierModule {}
