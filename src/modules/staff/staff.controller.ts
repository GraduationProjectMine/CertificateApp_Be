import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffService } from './staff.service';
import { UpdateStaffDto } from './dto/update-staff.dto';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'Get all staff members of the organization' })
  async findAll(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException('Only organization accounts can view staff');
    }
    const staffList = await this.staffService.findByOrganization(
      user.organization_id,
    );
    return staffList.map(({ password, ...staff }) => staff);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a staff member by ID' })
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = req.user;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only organization accounts can view staff details',
      );
    }
    const staff = await this.staffService.findById(id);
    if (!staff || staff.organization_id !== user.organization_id) {
      throw new NotFoundException(
        'Staff member not found or does not belong to your organization',
      );
    }
    const { password, ...result } = staff;
    return result;
  }

  @Put(':id')
  @ApiOperation({ summary: '[Issuer] Update a staff member' })
  @ApiBody({ type: UpdateStaffDto })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    const user = req.user;
    if (user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only organization administrators can update staff',
      );
    }
    return this.staffService.update(id, user.organization_id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '[Issuer] Delete a staff member' })
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = req.user;
    if (user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only organization administrators can delete staff',
      );
    }
    await this.staffService.delete(id, user.organization_id);
    return { message: 'Staff member deleted successfully' };
  }
}
