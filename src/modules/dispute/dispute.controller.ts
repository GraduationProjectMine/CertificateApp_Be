import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DisputeService } from './dispute.service';
import {
  IsString,
  IsOptional,
  IsIn,
  IsObject,
  MinLength,
} from 'class-validator';

class CreateDisputeDto {
  @IsString()
  certificate_id: string;

  @IsString()
  @MinLength(10)
  reason: string;

  @IsOptional()
  @IsString()
  details?: string;
}

class ReviewDisputeDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewer_note?: string;

  @IsOptional()
  @IsObject()
  new_cert_data?: Record<string, any>;
}

@ApiTags('disputes')
@ApiBearerAuth()
@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Student] Submit a correction/dispute request' })
  async createDispute(@Req() req: Request, @Body() body: CreateDisputeDto) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can file disputes');
    return this.disputeService.createDispute(
      user.sub,
      body.certificate_id,
      body.reason,
      body.details,
    );
  }

  @Get()
  @ApiOperation({ summary: '[Student] Get my dispute requests' })
  async getMyDisputes(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Access denied');
    return this.disputeService.getStudentDisputes(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Student] Get a specific dispute' })
  async getDispute(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Access denied');
    return this.disputeService.getDisputeById(id, user.sub);
  }

  @Get('org/list')
  @ApiOperation({ summary: '[Issuer/Staff] Get all disputes for my organization' })
  async getOrgDisputes(
    @Req() req: Request,
    @Query('status') status?: string,
  ) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff')
      throw new ForbiddenException('Only issuer/staff can view org disputes');
    return this.disputeService.getOrgDisputes(user.organization_id, status);
  }

  @Put(':id/review')
  @ApiOperation({ summary: '[Issuer/Staff] Approve or reject a dispute' })
  async reviewDispute(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: ReviewDisputeDto,
  ) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff')
      throw new ForbiddenException('Only issuer/staff can review disputes');
    return this.disputeService.reviewDispute(
      id,
      user.organization_id,
      user.sub,
      user.name,
      body.decision,
      body.reviewer_note,
      body.new_cert_data,
    );
  }
}
