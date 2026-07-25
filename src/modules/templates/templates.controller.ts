import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req, ForbiddenException,
  HttpCode, HttpStatus, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@ApiTags('templates')
@ApiBearerAuth()
@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Issuer/Staff] Create a new certificate template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Req() req: Request, @Body() dto: CreateTemplateDto) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException('Only issuer and staff can create templates');
    }
    return this.templatesService.create(user.organization_id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all templates for organization' })
  @ApiResponse({ status: 200, description: 'List of templates' })
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    return this.templatesService.findAll(user.organization_id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default template for organization' })
  @ApiResponse({ status: 200, description: 'Default template' })
  async getDefault(@Req() req: Request) {
    const user = req.user as any;
    return this.templatesService.getDefault(user.organization_id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiResponse({ status: 200, description: 'Template found' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    return this.templatesService.findOne(id, user.organization_id);
  }

  @Put(':id')
  @ApiOperation({ summary: '[Issuer/Staff] Update template' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException('Only issuer and staff can update templates');
    }
    return this.templatesService.update(id, user.organization_id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Issuer/Staff] Delete template' })
  @ApiResponse({ status: 200, description: 'Template deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async delete(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException('Only issuer and staff can delete templates');
    }
    return this.templatesService.delete(id, user.organization_id);
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[Issuer/Staff] Duplicate a template' })
  @ApiResponse({ status: 201, description: 'Template duplicated' })
  async duplicate(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException('Only issuer and staff can duplicate templates');
    }
    return this.templatesService.duplicate(id, user.organization_id);
  }

  @Post('import-data')
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
          description: 'CSV or Excel (.xlsx, .xls) file containing certificate template data rows',
        },
      },
    },
  })
  @ApiOperation({ summary: '[Issuer/Staff] Import CSV or Excel data file for certificate template loading' })
  async importData(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException('Only issuer and staff can import data for templates');
    }
    if (!file) {
      throw new BadRequestException('Please upload a CSV or Excel file');
    }
    return this.templatesService.parseAndMapImportFile(file.buffer, file.originalname);
  }
}
