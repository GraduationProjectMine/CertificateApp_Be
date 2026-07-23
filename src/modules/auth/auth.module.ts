import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { IssuerModule } from '../issuer/issuer.module';
import { StudentModule } from '../student/student.module';
import { StaffModule } from '../staff/staff.module';

import { BlockchainModule } from '../../core/blockchain/blockchain.module';

@Global()
@Module({
  imports: [
    IssuerModule,
    StudentModule,
    StaffModule,
    BlockchainModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'certificate-app-jwt-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
