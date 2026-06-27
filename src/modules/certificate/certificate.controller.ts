import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CertificateService } from './certificate.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';

@ApiTags('certificates')
@ApiBearerAuth()
@Controller('certificates')
@UseGuards(JwtAuthGuard)
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo hồ sơ văn bằng mới (trạng thái DRAFT)' })
  @ApiResponse({ status: 201, description: 'Certificate created' })
  async create(@Req() req: Request, @Body() dto: CreateCertificateDto) {
    const user = req.user as any;
    return this.certificateService.create(dto, user.id, user.organization_id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách văn bằng (lọc theo status nếu có)' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'APPROVED', 'IPFS_UPLOADED', 'BLOCKCHAIN_NOTARIZED'] })
  async findAll(@Req() req: Request, @Query('status') status?: string) {
    const user = req.user as any;
    return this.certificateService.findAll(user.organization_id, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết 1 văn bằng' })
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    return this.certificateService.findOne(id, user.organization_id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật hồ sơ văn bằng / chuyển trạng thái' })
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateCertificateDto) {
    const user = req.user as any;
    return this.certificateService.update(id, dto, user.id, user.organization_id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa hồ sơ văn bằng (chỉ DRAFT mới xóa được)' })
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    return this.certificateService.remove(id, user.organization_id);
  }
}