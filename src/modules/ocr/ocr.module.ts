import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { DiplomaParserService } from './diploma-parser.service';
import { IpfsModule } from '../ipfs/ipfs.module';

@Module({
  imports: [IpfsModule],
  controllers: [OcrController],
  providers: [OcrService, DiplomaParserService],
  exports: [OcrService, DiplomaParserService],
})
export class OcrModule {}
