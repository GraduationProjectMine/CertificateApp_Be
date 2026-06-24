import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('super-admin')
@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@ApiBearerAuth()
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('pending-institutions')
  @ApiResponse({ status: 200, description: 'List pending institutions' })
  async getPendingInstitutions() {
    return this.superAdminService.getPendingInstitutions();
  }

  @Get('institutions')
  @ApiResponse({ status: 200, description: 'List all institutions' })
  async getAllInstitutions() {
    return this.superAdminService.getAllInstitutions();
  }

  @Post('approve/:id')
  @ApiResponse({ status: 200, description: 'Institution approved' })
  async approve(@Param('id') id: string, @Req() req: any) {
    return this.superAdminService.approveInstitution(id, req.user.userId);
  }

  @Post('reject/:id')
  @ApiResponse({ status: 200, description: 'Institution rejected' })
  async reject(@Param('id') id: string, @Req() req: any) {
    return this.superAdminService.rejectInstitution(id, req.user.userId);
  }

  @Get('stats')
  @ApiResponse({ status: 200, description: 'Super admin stats' })
  async getStats() {
    return this.superAdminService.getStats();
  }
}
