import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { ActivationService } from './activation.service';
import { MailModule } from '../../core/mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [StudentController],
  providers: [StudentService, ActivationService],
  exports: [StudentService, ActivationService],
})
export class StudentModule {}
