import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { IssuerController } from './issuer.controller';
import { IssuerService } from './issuer.service';
import { StudentModule } from '../student/student.module';
import { StaffModule } from '../staff/staff.module';
import { BlockchainModule } from '../../core/blockchain/blockchain.module';
import { CryptoModule } from '../../core/crypto/crypto.module';

@Module({
  imports: [
    StudentModule,
    StaffModule,
    BlockchainModule,
    CryptoModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [IssuerController],
  providers: [IssuerService],
  exports: [IssuerService],
})
export class IssuerModule {}
