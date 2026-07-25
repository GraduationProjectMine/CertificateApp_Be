import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateTemplateDto) {
    const organization = await this.prisma.issuingOrganization.findUnique({
      where: { organization_id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Issuing organization not found');
    }

    if (dto.is_default) {
      await this.prisma.certificateTemplate.updateMany({
        where: { organization_id: organizationId, is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.certificateTemplate.create({
      data: {
        organization_id: organizationId,
        name: dto.name,
        description: dto.description,
        design_data: dto.design_data as any,
        thumbnail_url: dto.thumbnail_url,
        is_default: dto.is_default ?? false,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.certificateTemplate.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, organizationId?: string) {
    const template = await this.prisma.certificateTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (organizationId && template.organization_id !== organizationId) {
      throw new ForbiddenException('You do not have access to this template');
    }

    return template;
  }

  async update(id: string, organizationId: string, dto: UpdateTemplateDto) {
    await this.findOne(id, organizationId);

    if (dto.is_default) {
      await this.prisma.certificateTemplate.updateMany({
        where: { organization_id: organizationId, is_default: true, id: { not: id } },
        data: { is_default: false },
      });
    }

    return this.prisma.certificateTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.design_data !== undefined && { design_data: dto.design_data as any }),
        ...(dto.thumbnail_url !== undefined && { thumbnail_url: dto.thumbnail_url }),
        ...(dto.is_default !== undefined && { is_default: dto.is_default }),
      },
    });
  }

  async delete(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    await this.prisma.certificateTemplate.delete({ where: { id } });

    return { message: 'Template deleted successfully' };
  }

  async getDefault(organizationId: string) {
    return this.prisma.certificateTemplate.findFirst({
      where: { organization_id: organizationId, is_default: true },
    });
  }

  async duplicate(id: string, organizationId: string) {
    const original = await this.findOne(id, organizationId);

    return this.prisma.certificateTemplate.create({
      data: {
        organization_id: organizationId,
        name: `${original.name} (Sao chép)`,
        description: original.description,
        design_data: original.design_data as any,
        thumbnail_url: original.thumbnail_url,
        is_default: false,
      },
    });
  }

  parseAndMapImportFile(fileBuffer: Buffer, originalName: string) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('File is empty');
    }

    const lower = originalName.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      throw new BadRequestException('Only CSV and Excel (.xlsx, .xls) files are supported');
    }

    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new BadRequestException('Excel file has no sheets');
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (!aoa || aoa.length === 0) {
        throw new BadRequestException('File contains no data');
      }

      let headerRowIdx = -1;
      for (let i = 0; i < aoa.length; i++) {
        const rowStr = (aoa[i] || []).map((c) => String(c ?? '').toLowerCase().trim()).join(' ');
        if (
          rowStr.includes('id sinh viên') ||
          rowStr.includes('student_id') ||
          rowStr.includes('mã sinh viên') ||
          rowStr.includes('tên văn bằng') ||
          rowStr.includes('họ tên') ||
          rowStr.includes('full_name')
        ) {
          headerRowIdx = i;
          break;
        }
      }
      if (headerRowIdx === -1) {
        headerRowIdx = aoa.findIndex((r) => r && r.some((c) => String(c ?? '').trim().length > 0));
      }
      if (headerRowIdx === -1 || headerRowIdx >= aoa.length) {
        throw new BadRequestException('No valid headers found in file');
      }

      const rawHeaders = (aoa[headerRowIdx] as string[]).map((h) => String(h ?? '').trim());
      const validHdrIndices = rawHeaders.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
      const headers = validHdrIndices.map((i) => rawHeaders[i]);

      const dataRows = aoa.slice(headerRowIdx + 1).filter((r: unknown[]) => r && r.some((c) => String(c ?? '').trim()));

      const fieldAliasMap: Record<string, string[]> = {
        student_id: ['id sinh viên', 'mã sinh viên', 'ma sv', 'student_id', 'student id', 'masv'],
        student_fullName: ['họ và tên', 'họ tên', 'tên sinh viên', 'student_fullname', 'full_name', 'student_name', 'name', 'hoten'],
        certificate_title: ['tên văn bằng', 'văn bằng', 'certificate_title', 'title', 'cert_title'],
        dob: ['ngày sinh', 'dob', 'birth_date', 'date_of_birth', 'ngaysinh'],
        placeOfBirth: ['nơi sinh', 'placeofbirth', 'place_of_birth', 'noisinh'],
        gender: ['giới tính', 'gender', 'gioitinh', 'sex'],
        ethnicity: ['dân tộc', 'ethnicity', 'dantoc'],
        schoolName: ['tên trường', 'trường', 'schoolname', 'school_name', 'school'],
        examCohort: ['khóa', 'khóa học', 'năm tn', 'examcohort', 'exam_cohort', 'cohort'],
        examBoard: ['hội đồng thi', 'examboard', 'exam_board', 'board'],
        issueLocation: ['nơi cấp', 'issuelocation', 'issue_location', 'location'],
        issueDate: ['ngày cấp', 'issuedate', 'issue_date', 'ngaycap'],
        serialNumber: ['số hiệu', 'serialnumber', 'serial_number', 'serial'],
        registryNumber: ['số vào sổ', 'registrynumber', 'registry_number', 'registry'],
      };

      const columnMapping: Record<string, string> = {};
      for (const [targetKey, aliases] of Object.entries(fieldAliasMap)) {
        const foundHdr = headers.find((h) => {
          const lowerH = h.toLowerCase().trim();
          return aliases.some((alias) => lowerH === alias || lowerH.includes(alias));
        });
        if (foundHdr) {
          columnMapping[targetKey] = foundHdr;
        }
      }

      const rows = dataRows.map((r: unknown[], idx) => {
        const record: Record<string, string> = {};
        for (const [targetKey, hdrName] of Object.entries(columnMapping)) {
          const hdrIdx = headers.indexOf(hdrName);
          if (hdrIdx >= 0) {
            record[targetKey] = String((r as unknown[])[validHdrIndices[hdrIdx]] ?? '').trim();
          }
        }
        headers.forEach((h, hIdx) => {
          const val = String((r as unknown[])[validHdrIndices[hIdx]] ?? '').trim();
          if (val && !record[h]) {
            record[h] = val;
          }
        });

        const missingFields: string[] = [];
        if (!record.student_fullName && !record.student_id) missingFields.push('Họ tên / Mã SV');
        if (!record.certificate_title) missingFields.push('Tên văn bằng');

        return {
          rowNumber: idx + 1,
          record,
          isValid: missingFields.length === 0,
          missingFields,
        };
      });

      const validRowsCount = rows.filter((r) => r.isValid).length;
      const invalidRowsCount = rows.filter((r) => !r.isValid).length;

      return {
        fileName: originalName,
        headers,
        totalRows: rows.length,
        validRowsCount,
        invalidRowsCount,
        rows,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Failed to parse import file: ${err.message}`);
    }
  }
}
