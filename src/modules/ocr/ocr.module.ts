import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { DiplomaParserService } from './diploma-parser.service';

@Module({
  controllers: [OcrController],
  providers: [OcrService, DiplomaParserService],
  exports: [OcrService, DiplomaParserService],
})
export class OcrModule {}
