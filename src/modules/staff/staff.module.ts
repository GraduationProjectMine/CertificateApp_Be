import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
