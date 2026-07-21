import { Module } from '@nestjs/common';
import { CertificateModule } from '../certificate/certificate.module';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';

@Module({
  imports: [CertificateModule],
  controllers: [BatchesController],
  providers: [BatchesService],
})
export class BatchesModule {}
