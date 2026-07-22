import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  Res,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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

  // ==================== Wallet Management ====================

  @Get('organizations/:id/wallet')
  @ApiOperation({ summary: '[SysAdmin] Get org wallet info (address + balance)' })
  async getOrgWallet(@Req() req: Request, @Param('id') id: string) {
    this.assertSysAdmin(req);
    return this.superAdminService.getOrgWalletInfo(id);
  }

  @Post('organizations/:id/wallet/fund')
  @ApiOperation({ summary: '[SysAdmin] Fund org wallet with ETH from admin' })
  async fundOrgWallet(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('amount') amount: string,
  ) {
    this.assertSysAdmin(req);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new ForbiddenException('Invalid amount');
    }
    return this.superAdminService.fundOrgWallet(id, amount);
  }

  @Post('organizations/:id/deauthorize')
  @ApiOperation({ summary: '[SysAdmin] Deauthorize org on blockchain' })
  async deauthorizeOrg(@Req() req: Request, @Param('id') id: string) {
    this.assertSysAdmin(req);
    return this.superAdminService.deauthorizeOrg(id);
  }

  @Post('organizations/:id/reauthorize')
  @ApiOperation({ summary: '[SysAdmin] Re-authorize org on blockchain' })
  async reauthorizeOrg(@Req() req: Request, @Param('id') id: string) {
    this.assertSysAdmin(req);
    return this.superAdminService.reauthorizeOrg(id);
  }

  @Get('wallet/overview')
  @ApiOperation({ summary: '[SysAdmin] Get all org wallets overview' })
  async getWalletsOverview(@Req() req: Request) {
    this.assertSysAdmin(req);
    return this.superAdminService.getWalletsOverview();
  }

  // ==================== Certificate Management ====================

  @Get('certificates')
  @ApiOperation({ summary: '[SysAdmin] List all certificates cross-organization' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, description: 'DRAFT | PENDING | ISSUED | REVOKED' })
  @ApiQuery({ name: 'organization_id', required: false })
  async listCertificates(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('organization_id') organizationId?: string,
  ) {
    this.assertSysAdmin(req);
    return this.superAdminService.findAllCertificates({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search,
      status,
      organization_id: organizationId,
    });
  }

  @Get('certificates/stats')
  @ApiOperation({ summary: '[SysAdmin] Get certificate statistics (for charts)' })
  async getCertificateStats(@Req() req: Request) {
    this.assertSysAdmin(req);
    return this.superAdminService.getCertificateStats();
  }

  @Get('certificates/:id')
  @ApiOperation({ summary: '[SysAdmin] Get certificate details by ID' })
  async getCertificate(@Req() req: Request, @Param('id') id: string) {
    this.assertSysAdmin(req);
    const cert = await this.superAdminService.findCertificateById(id);
    if (!cert) throw new NotFoundException('Certificate not found');
    return cert;
  }

  // ==================== System Health & Activity ====================

  @Get('system-health')
  @ApiOperation({ summary: '[SysAdmin] Get system health (blockchain, IPFS)' })
  async getSystemHealth(@Req() req: Request) {
    this.assertSysAdmin(req);
    return this.superAdminService.getSystemHealth();
  }

  @Get('recent-activity')
  @ApiOperation({ summary: '[SysAdmin] Get recent system activity feed' })
  async getRecentActivity(@Req() req: Request) {
    this.assertSysAdmin(req);
    return this.superAdminService.getRecentActivity();
  }

  // ==================== User Management Nâng cao ====================

  @Get('users/:id')
  @ApiOperation({ summary: '[SysAdmin] Get system user details' })
  async getUser(@Req() req: Request, @Param('id') id: string) {
    this.assertSysAdmin(req);
    return this.superAdminService.findUserById(id);
  }

  @Put('users/:id/lock')
  @ApiOperation({ summary: '[SysAdmin] Lock system user' })
  async lockUser(@Req() req: Request, @Param('id') id: string) {
    this.assertSysAdmin(req);
    return this.superAdminService.updateUserStatus(id, 'SUSPENDED');
  }

  @Put('users/:id/unlock')
  @ApiOperation({ summary: '[SysAdmin] Unlock system user' })
  async unlockUser(@Req() req: Request, @Param('id') id: string) {
    this.assertSysAdmin(req);
    return this.superAdminService.updateUserStatus(id, 'ACTIVE');
  }

  @Put('users/:id/reset-password')
  @ApiOperation({ summary: '[SysAdmin] Reset system user password' })
  async resetPassword(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('password') password?: string,
  ) {
    this.assertSysAdmin(req);
    return this.superAdminService.resetUserPassword(id, password);
  }

  // ==================== Super Admin CRUD ====================

  @Get('admins')
  @ApiOperation({ summary: '[SysAdmin] List all super admins' })
  async listSuperAdmins(@Req() req: Request) {
    this.assertSysAdmin(req);
    return this.superAdminService.listSuperAdmins();
  }

  @Post('admins')
  @ApiOperation({ summary: '[SysAdmin] Create a new super admin' })
  async createSuperAdmin(
    @Req() req: Request,
    @Body() body: { name: string; email: string; password?: string },
  ) {
    this.assertSysAdmin(req);
    if (!body.name || !body.email) {
      throw new ForbiddenException('Name and email are required');
    }
    return this.superAdminService.createSuperAdmin(body);
  }

  // ==================== Infrastructure Monitoring ====================

  @Get('infrastructure/blockchain')
  @ApiOperation({ summary: '[SysAdmin] Get detailed blockchain node information' })
  async getBlockchainInfo(@Req() req: Request) {
    this.assertSysAdmin(req);
    return this.superAdminService.getDetailedBlockchainOverview();
  }

  @Get('infrastructure/ipfs')
  @ApiOperation({ summary: '[SysAdmin] Get detailed IPFS / Pinata health' })
  async getIpfsInfo(@Req() req: Request) {
    this.assertSysAdmin(req);
    return this.superAdminService.getDetailedIpfsOverview();
  }

  @Get('infrastructure/contract')
  @ApiOperation({ summary: '[SysAdmin] Get deployed Smart Contract owner and address' })
  async getContractInfo(@Req() req: Request) {
    this.assertSysAdmin(req);
    return this.superAdminService.getDetailedContractInfo();
  }

  // ==================== System Configuration ====================

  @Get('config')
  @ApiOperation({ summary: '[SysAdmin] Get system configuration' })
  async getConfig(@Req() req: Request) {
    this.assertSysAdmin(req);
    return this.superAdminService.getSystemConfig();
  }

  @Put('config')
  @ApiOperation({ summary: '[SysAdmin] Update system configuration' })
  async updateConfig(@Req() req: Request, @Body() configs: Record<string, string>) {
    this.assertSysAdmin(req);
    return this.superAdminService.updateSystemConfig(configs);
  }

  // ==================== Export Data (CSV) ====================

  @Get('export/organizations')
  @ApiOperation({ summary: '[SysAdmin] Export organizations list as CSV' })
  async exportOrganizations(@Req() req: Request, @Res() res: Response) {
    this.assertSysAdmin(req);
    const csv = await this.superAdminService.exportOrganizationsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=organizations.csv');
    res.status(200).send(csv);
  }

  @Get('export/certificates')
  @ApiOperation({ summary: '[SysAdmin] Export certificates list as CSV' })
  async exportCertificates(@Req() req: Request, @Res() res: Response) {
    this.assertSysAdmin(req);
    const csv = await this.superAdminService.exportCertificatesCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=certificates.csv');
    res.status(200).send(csv);
  }

  @Get('export/users')
  @ApiOperation({ summary: '[SysAdmin] Export users list as CSV' })
  async exportUsers(@Req() req: Request, @Res() res: Response) {
    this.assertSysAdmin(req);
    const csv = await this.superAdminService.exportUsersCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.status(200).send(csv);
  }
}


