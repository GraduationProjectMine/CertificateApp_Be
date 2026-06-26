import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { IssuerController } from './issuer.controller';
import { IssuerService } from './issuer.service';
import { StudentModule } from '../student/student.module';

@Module({
  imports: [StudentModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [IssuerController],
  providers: [IssuerService],
  exports: [IssuerService],
})
export class IssuerModule {}
