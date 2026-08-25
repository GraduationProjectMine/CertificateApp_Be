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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StudentService } from './student.service';
import { CreateStudentDto } from '../issuer/dto/create-student.dto';
import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

class UpdateProfileDto {
  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Full name',
    required: false,
  })
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'sv@example.com',
    description: 'Email',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;
}

class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ss1', description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ example: 'NewP@ss1', description: 'New password' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  newPassword!: string;
}

class UpdateStudentDto {
  @ApiProperty({
    example: 'Trần Thị C',
    description: 'Full name of student',
    required: false,
  })
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'sinhvien@example.com',
    description: 'Email of student',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: false,
    description: 'Active status of student account',
    required: false,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    example: 'StrongP@ss2',
    description: 'New password',
    required: false,
  })
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
    const students = await this.studentService.findAll(user.organization_id);
    return students.map(({ password, ...rest }) => rest);
  }

  @Get('import/template')
  @ApiOperation({ summary: 'Download CSV template for student import' })
  async downloadTemplate(@Res() res: Response) {
    const header =
      'name,email\n"Nguyễn Văn A",sinhvien1@example.com\n"Trần Thị B",sinhvien2@example.com\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="student-import-template.csv"',
    );
    res.send(header);
  }

  @Get('import/history')
  @ApiOperation({ summary: 'Get student import history' })
  async importHistory(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can view import history',
      );
    }
    return this.studentService.getImportHistory(user.organization_id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Student update own profile' })
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can update their profile');
    const student = await this.studentService.updateProfile(user.sub, dto);
    const { password, ...result } = student;
    return { message: 'Profile updated successfully', student: result };
  }

  @Put('change-password')
  @ApiOperation({ summary: 'Student change own password' })
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can change their password');
    await this.studentService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Password changed successfully' };
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

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file with columns: name, email',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Import students from CSV file' })
  async import(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can import students',
      );
    }
    if (!file) throw new BadRequestException('Vui lòng upload file CSV');
    if (!file.originalname.endsWith('.csv'))
      throw new BadRequestException('Chỉ hỗ trợ file CSV');
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('File không được quá 5MB');

    return this.studentService.importFromCsv(
      file.buffer,
      file.originalname,
      user.organization_id,
      user.organization_name || user.name,
      user.sub,
      user.name,
    );
  }
}
