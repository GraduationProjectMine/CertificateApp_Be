import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DisputeService } from './dispute.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ReviewDisputeDto } from './dto/review-dispute.dto';

@ApiTags('disputes')
@ApiBearerAuth()
@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  @ApiOperation({
    summary: '[Student] Create correction request for DRAFT certificate',
  })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateDisputeDto) {
    const user = req.user;
    if (user.role !== 'student') {
      throw new ForbiddenException(
        'Chỉ có sinh viên mới có thể gửi yêu cầu chỉnh sửa.',
      );
    }
    return this.disputeService.createDispute(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '[Student] List my correction requests' })
  async findMyDisputes(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    if (user.role !== 'student') {
      throw new ForbiddenException(
        'Chỉ có sinh viên mới có thể xem danh sách yêu cầu của mình.',
      );
    }
    return this.disputeService.findByStudent(user.id);
  }

  @Get('org/list')
  @ApiOperation({
    summary: '[Issuer/Staff] List organization correction requests',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter status (PENDING, APPROVED, REJECTED)',
  })
  async findOrgDisputes(@Req() req: AuthenticatedRequest, @Query('status') status?: string) {
    const user = req.user;
    if (
      user.role !== 'issuer' &&
      user.role !== 'staff' &&
      user.role !== 'super_admin'
    ) {
      throw new ForbiddenException(
        'Chỉ có tổ chức phát hành hoặc nhân viên mới có quyền xem danh sách.',
      );
    }
    return this.disputeService.findByOrganization(user.organization_id, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dispute details by ID' })
  async findOne(@Param('id') id: string) {
    return this.disputeService.findOne(id);
  }

  @Put(':id/review')
  @ApiOperation({ summary: '[Issuer/Staff] Review correction request' })
  async review(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewDisputeDto,
  ) {
    const user = req.user;
    if (
      user.role !== 'issuer' &&
      user.role !== 'staff' &&
      user.role !== 'super_admin'
    ) {
      throw new ForbiddenException(
        'Chỉ có tổ chức phát hành hoặc nhân viên mới có quyền xử lý yêu cầu.',
      );
    }
    return this.disputeService.reviewDispute(
      id,
      user.organization_id,
      user.id,
      dto,
    );
  }
}
