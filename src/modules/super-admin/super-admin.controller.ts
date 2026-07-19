import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminService } from './super-admin.service';

@ApiTags('super-admin')
@ApiBearerAuth()
@Controller('super-admin')
@UseGuards(JwtAuthGuard)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  private assertSysAdmin(req: Request) {
    const user = req.user as any;
    if (user.role !== 'sysadmin') {
      throw new ForbiddenException('Only system administrators can access this endpoint');
    }
    return user;
  }

  @Get('dashboard')
  @ApiOperation({ summary: '[SysAdmin] Get system-wide dashboard overview' })
  async getDashboard(@Req() req: Request) {
    this.assertSysAdmin(req);
    return this.superAdminService.getDashboard();
  }

  @Get('organizations')
  @ApiOperation({ summary: '[SysAdmin] List all organizations' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, description: 'verified | pending' })
  async listOrganizations(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    this.assertSysAdmin(req);
    return this.superAdminService.findAllOrganizations({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search,
      status,
    });
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: '[SysAdmin] Get organization details' })
  async getOrganization(@Req() req: Request, @Param('id') id: string) {
    this.assertSysAdmin(req);
    const org = await this.superAdminService.findOrganizationById(id);
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  @Put('organizations/:id/verify')
  @ApiOperation({ summary: '[SysAdmin] Verify/approve an organization' })
  async verifyOrganization(@Req() req: Request, @Param('id') id: string) {
    this.assertSysAdmin(req);
    const org = await this.superAdminService.findOrganizationById(id);
    if (!org) throw new NotFoundException('Organization not found');
    return this.superAdminService.verifyOrganization(id);
  }

  @Put('organizations/:id/suspend')
  @ApiOperation({ summary: '[SysAdmin] Suspend an organization' })
  async suspendOrganization(@Req() req: Request, @Param('id') id: string) {
    this.assertSysAdmin(req);
    const org = await this.superAdminService.findOrganizationById(id);
    if (!org) throw new NotFoundException('Organization not found');
    return this.superAdminService.suspendOrganization(id);
  }

  @Get('users')
  @ApiOperation({ summary: '[SysAdmin] List all users across organizations' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'role', required: false, description: 'staff | issuer | student' })
  @ApiQuery({ name: 'organization_id', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listUsers(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('organization_id') organizationId?: string,
    @Query('search') search?: string,
  ) {
    this.assertSysAdmin(req);
    return this.superAdminService.findAllUsers({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      role,
      organization_id: organizationId,
      search,
    });
  }

  @Get('audit-logs')
  @ApiOperation({ summary: '[SysAdmin] List all audit logs system-wide' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listAuditLogs(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    this.assertSysAdmin(req);
    return this.superAdminService.findAllAuditLogs({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      action,
      search,
    });
  }
}
