import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuerService } from './issuer.service';
import { StaffAccount } from '../../core/database/entities/staff-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StaffAccount])],
  providers: [IssuerService],
  exports: [IssuerService],
})
export class IssuerModule {}