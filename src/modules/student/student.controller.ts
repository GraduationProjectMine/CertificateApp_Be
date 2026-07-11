import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  ConflictException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StudentService } from './student.service';
import { CreateStudentDto } from '../issuer/dto/create-student.dto';
import { IsEmail, IsString, MinLength, Matches, IsOptional } from 'class-validator';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

class UpdateStudentDto {
  @ApiProperty({ example: 'Trần Thị C', description: 'Full name of student', required: false })
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'sinhvien@example.com', description: 'Email of student', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'ACTIVE', description: 'Status of student account', required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: 'StrongP@ss2', description: 'New password', required: false })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  @IsOptional()
  password?: string;
}

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
@UseGuards(JwtAuthGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  @ApiOperation({ summary: 'Get all students of the organization' })
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can view students',
      );
    }
    return this.studentService.findAll(user.organization_id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student details by ID' })
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can view student details',
      );
    }
    const student = await this.studentService.findById(id);
    if (!student || student.organization_id !== user.organization_id) {
      throw new ForbiddenException(
        'You do not have access to this student account',
      );
    }
    const { password, ...result } = student;
    return result;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new student' })
  async create(@Req() req: Request, @Body() dto: CreateStudentDto) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can create students',
      );
    }
    const existing = await this.studentService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const student = await this.studentService.create(
      dto.name,
      dto.email,
      hashedPassword,
      user.organization_id,
    );
    const { password, ...result } = student;
    return { message: 'Student account created successfully', student: result };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a student account' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can update students',
      );
    }
    const student = await this.studentService.update(
      id,
      user.organization_id,
      dto,
    );
    const { password, ...result } = student;
    return { message: 'Student account updated successfully', student: result };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a student account' })
  async delete(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can delete students',
      );
    }
    return this.studentService.delete(id, user.organization_id);
  }
}
