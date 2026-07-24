import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MonitorService } from './monitor.service';

@ApiTags('system')
@ApiBearerAuth()
@Controller('system')
@UseGuards(JwtAuthGuard)
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get('monitor')
  @ApiOperation({
    summary: 'Get blockchain, wallet and IPFS health with recent transactions',
  })
  getOverview(@Req() req: Request) {
    const user = req.user as any;
    if (user?.role !== 'super_admin') {
      throw new ForbiddenException(
        'Only System Administrators (super_admin) can view infrastructure status',
      );
    }
    return this.monitorService.getOverview();
  }
}
