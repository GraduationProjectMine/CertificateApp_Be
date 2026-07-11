import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffService } from '../staff/staff.service';
import { StudentService } from '../student/student.service';
import { IssuerService } from './issuer.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export class UpdateOrganizationDto {
  @ApiProperty({ example: 'Đại học Bách Khoa Hà Nội', required: false })
  @IsString()
  @IsOptional()
  organization_name?: string;

  @ApiProperty({ example: 'hust@edu.vn', required: false })
  @IsEmail()
  @IsOptional()
  contact_email?: string;

  @ApiProperty({ example: 'https://hust.edu.vn/logo.png', required: false })
  @IsString()
  @IsOptional()
  logo_url?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;

  @ApiProperty({ example: '0x1234...', required: false })
  @IsString()
  @IsOptional()
  wallet_address?: string;
}

@ApiTags('issuer')
@ApiBearerAuth()
@Controller('issuer')
@UseGuards(JwtAuthGuard)
export class IssuerController {
  constructor(
    private readonly staffService: StaffService,
    private readonly studentService: StudentService,
    private readonly issuerService: IssuerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current organization details' })
  async getProfile(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can view organization details',
      );
    }
    return this.issuerService.findById(user.organization_id);
  }

  @Put()
  @ApiOperation({ summary: 'Update current organization details' })
  async updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateOrganizationDto,
  ) {
    const user = req.user as any;
    if (user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only organization administrators can update organization details',
      );
    }
    // Organization administrators should not self-verify or modify contract settings directly
    const { is_verified, ...allowedDto } = dto;
    return this.issuerService.update(user.organization_id, allowedDto);
  }



  @Post('staff')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Issuer] Create a new staff account under this organization',
  })
  @ApiBody({ type: CreateStaffDto })
  @ApiResponse({
    status: 201,
    description: 'Staff account created successfully',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only organization admin can perform this action',
  })
  async createStaff(@Req() req: Request, @Body() dto: CreateStaffDto) {
    const issuer = req.user as any;
    if (issuer.role !== 'issuer') {
      throw new ForbiddenException(
        'Only organization administrators can perform this action',
      );
    }

    const existing = await this.staffService.findByEmail(dto.email);
    if (existing) {
      return { statusCode: 409, message: 'Email already exists' };
    }
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const staff = await this.staffService.create(
      dto.name,
      dto.email,
      hashedPassword,
      issuer.organization_id,
      undefined,
      'STAFF',
    );
    const { password, ...result } = staff;
    return { message: 'Staff account created successfully', staff: result };
  }

  @Post('students')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Issuer] Create a new student account under this organization',
  })
  @ApiBody({ type: CreateStudentDto })
  @ApiResponse({
    status: 201,
    description: 'Student account created successfully',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only organization admin can perform this action',
  })
  async createStudent(@Req() req: Request, @Body() dto: CreateStudentDto) {
    const issuer = req.user as any;
    if (issuer.role !== 'issuer') {
      throw new ForbiddenException(
        'Only organization administrators can perform this action',
      );
    }

    const existing = await this.studentService.findByEmail(dto.email);
    if (existing) {
      return { statusCode: 409, message: 'Email already exists' };
    }
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const student = await this.studentService.create(
      dto.name,
      dto.email,
      hashedPassword,
      issuer.organization_id,
    );
    const { password, ...result } = student;
    return { message: 'Student account created successfully', student: result };
  }
}
