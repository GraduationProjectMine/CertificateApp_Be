import {
  Controller,
  Post,
  Body,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffService } from '../staff/staff.service';
import { StudentService } from '../student/student.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

@ApiTags('issuer')
@ApiBearerAuth()
@Controller('issuer')
@UseGuards(JwtAuthGuard)
export class IssuerController {
  constructor(
    private readonly staffService: StaffService,
    private readonly studentService: StudentService,
  ) {}

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
  @ApiResponse({ status: 403, description: 'Forbidden - Only organization admin can perform this action' })
  async createStaff(@Req() req: Request, @Body() dto: CreateStaffDto) {
    const issuer = req.user as any;
    if (issuer.role !== 'issuer') {
      throw new ForbiddenException('Only organization administrators can perform this action');
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
  @ApiResponse({ status: 403, description: 'Forbidden - Only organization admin can perform this action' })
  async createStudent(@Req() req: Request, @Body() dto: CreateStudentDto) {
    const issuer = req.user as any;
    if (issuer.role !== 'issuer') {
      throw new ForbiddenException('Only organization administrators can perform this action');
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
