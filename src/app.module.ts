import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OcrModule } from './modules/ocr/ocr.module';
import { IpfsModule } from './modules/ipfs/ipfs.module';
import { BlockchainModule } from './core/blockchain/blockchain.module';

@Module({
  imports: [OcrModule, IpfsModule, BlockchainModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
