import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationService } from './organization.service';
import { IssuingOrganization } from '../../core/database/entities/issuing-organization.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IssuingOrganization])],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}