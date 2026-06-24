import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { BlockchainService } from '../../core/blockchain/blockchain.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [SuperAdminController],
  providers: [SuperAdminService, BlockchainService, JwtAuthGuard, RolesGuard],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
