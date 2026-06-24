import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { IssuerController } from './issuer.controller';
import { IssuerService } from './issuer.service';
import { StudentModule } from '../student/student.module';
import { StaffAccount } from '../../core/database/entities/staff-account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffAccount]),
    StudentModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [IssuerController],
  providers: [IssuerService],
  exports: [IssuerService],
})
export class IssuerModule {}