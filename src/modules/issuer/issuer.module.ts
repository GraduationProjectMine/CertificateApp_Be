import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { IssuerController } from './issuer.controller';
import { IssuerService } from './issuer.service';
import { StudentModule } from '../student/student.module';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [
    StudentModule,
    StaffModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [IssuerController],
  providers: [IssuerService],
  exports: [IssuerService],
})
export class IssuerModule {}
