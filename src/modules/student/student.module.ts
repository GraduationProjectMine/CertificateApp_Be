import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentService } from './student.service';
import { StudentAccount } from '../../core/database/entities/student-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StudentAccount])],
  providers: [StudentService],
  exports: [StudentService],
})
export class StudentModule {}