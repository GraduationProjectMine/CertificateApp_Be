import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CertificateService } from './certificate.service';
import {
  CreateCertificateDto,
  RevokeCertificateDto,
  UpdateCertificateDto,
  BatchApproveDto,
  TemplateBatchIssueDto,
} from './dto/certificate.dto';

@ApiTags('certificates')
@ApiBearerAuth()
@Controller('certificates')
@UseGuards(JwtAuthGuard)
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  /**
   * Create a new draft certificate.
   * Only accessible to accounts with the 'issuer' role.
   */
  @Post('draft')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Issuer] Create a certificate draft',
    description: 'Saves certificate metadata to the local database as a draft.',
  })
  @ApiResponse({
    status: 201,
    description: 'Certificate draft created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only issuers can create drafts',
  })
  async createDraft(@Req() req: Request, @Body() dto: CreateCertificateDto) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can create drafts',
      );
    }
    return this.certificateService.createDraft(user.organization_id, dto, {
      id: user.id,
      name: user.name,
    });
  }

  /**
   * Get all certificates.
   * Issuers see certificates belonging to their organization.
   * Students see only their own certificates.
   */
  @Get()
  @ApiOperation({
    summary: 'Get all certificates / drafts',
    description:
      'Retrieve a list of certificates. If user is an issuer, this returns certificates for their organization. If student, this returns only their certificates.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (DRAFT, PENDING, ISSUED, REVOKED)',
  })
  @ApiQuery({
    name: 'student_id',
    required: false,
    description: 'Filter by student ID (Issuers only)',
  })
  async findAll(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('student_id') studentId?: string,
  ) {
    const user = req.user as any;

    if (user.role === 'student') {
      // Students can only see their own certificates, ignoring other query filters
      return this.certificateService.findAll({
        student_id: user.id,
        status,
      });
    }

    // Issuers see all certificates belonging to their organization, with optional filters
    return this.certificateService.findAll({
      organization_id: user.organization_id,
      student_id: studentId,
      status,
    });
  }

  @Get('revoked')
  @ApiOperation({ summary: '[Issuer] List revoked certificates' })
  async findRevoked(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only organization accounts can view revocations',
      );
    }
    return this.certificateService.findRevoked(
      user.organization_id,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Get('online')
  @ApiOperation({
    summary: 'Get all online certificates issued via templates',
    description: 'Retrieve a list of online certificates in the online_certificates table.',
  })
  async findAllOnline(@Req() req: Request) {
    const user = req.user as any;
    if (user.role === 'student') {
      return this.certificateService.findAllOnlineCertificates({ student_id: user.id });
    }
    return this.certificateService.findAllOnlineCertificates({ organization_id: user.organization_id });
  }

  /**
   * Get a certificate by ID.
   * Issuers can access certificates of their organization.
   * Students can access only their own certificates.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a certificate by ID',
    description: 'Retrieve detailed information of a certificate.',
  })
  @ApiResponse({ status: 200, description: 'Certificate found' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;

    const certificate = await this.certificateService.findOne(id);

    if (user.role === 'student') {
      if (certificate.student_id !== user.id) {
        throw new ForbiddenException(
          'You do not have permission to view this certificate',
        );
      }
      return {
        ...certificate,
        file_url: null,
      };
    } else {
      if (certificate.organization_id !== user.organization_id) {
        throw new ForbiddenException(
          'You do not have permission to view this certificate',
        );
      }
      return certificate;
    }
  }

  /**
   * Update the status of a certificate.
   * Only accessible to issuers and for certificates belonging to their organization.
   */
  @Put(':id')
  @ApiOperation({
    summary: '[Issuer] Update certificate status',
    description:
      'Update the status of a certificate (e.g., from DRAFT to PENDING).',
  })
  @ApiResponse({
    status: 200,
    description: 'Certificate status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCertificateDto,
  ) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can update certificates',
      );
    }
    return this.certificateService.update(id, user.organization_id, dto);
  }

  /**
   * Approve a pending certificate: upload to IPFS and issue on blockchain.
   * Only accessible to issuing organizations.
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Issuer] Approve and issue certificate to Blockchain/IPFS',
    description:
      'Constructs the certificate payload, stores it on IPFS via Pinata, signs and registers it on the blockchain smart contract, and sets status to ISSUED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Certificate approved and issued successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status or missing metadata fields',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async approve(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only issuing organization accounts can approve/issue certificates',
      );
    }
    return this.certificateService.approve(id, user.organization_id, {
      id: user.id,
      name: user.name,
    });
  }

  @Get('import/template')
  @ApiOperation({ summary: 'Download CSV/Excel template for certificate import' })
  async downloadTemplate(@Res() res: Response) {
    const header = 'student_id,certificate_title,student_fullName,dob,placeOfBirth,gender,ethnicity,schoolName,examCohort,examBoard,issueLocation,issueDate,serialNumber,registryNumber\n"SV001","Cử nhân CNTT","Nguyễn Văn A","2002-05-15","Hà Nội","Nam","Kinh","ĐH Bách Khoa Hà Nội","2025","Hội đồng 1","Hà Nội","2025-06-15","BK-2025-001","001"\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="certificate-import-template.csv"');
    res.send(header);
  }

  @Post('batch-approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Issuer] Batch approve multiple PENDING certificates',
    description: 'Approve multiple certificates in batch. Each certificate still creates an individual blockchain transaction.',
  })
  @ApiBody({ type: BatchApproveDto })
  async batchApprove(@Req() req: Request, @Body() dto: BatchApproveDto) {
    const user = req.user as any;
    if (user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only issuing organization accounts can approve certificates',
      );
    }
    return this.certificateService.batchApprove(dto.ids, user.organization_id, {
      id: user.id,
      name: user.name,
    });
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Issuer] Revoke an issued certificate on-chain' })
  async revoke(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RevokeCertificateDto,
  ) {
    const user = req.user as any;
    if (user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only issuing organization administrators can revoke certificates',
      );
    }
    return this.certificateService.revoke(
      id,
      user.organization_id,
      user.id,
      dto.reason,
      user.name,
    );
  }

  @Post(':id/retry-revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Issuer] Safely retry a failed revocation' })
  async retryRevoke(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only issuing organization administrators can retry revocations',
      );
    }
    return this.certificateService.retryRevoke(
      id,
      user.organization_id,
      user.id,
      user.name,
    );
  }

  /**
   * Delete a certificate draft or pending certificate.
   * Only accessible to issuers and for DRAFT/PENDING status certificates.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Issuer] Delete a certificate',
    description:
      'Delete a certificate from the database. Only certificates in DRAFT or PENDING status can be deleted.',
  })
  @ApiResponse({ status: 200, description: 'Certificate deleted successfully' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden / ISSUED certificates cannot be deleted',
  })
  async delete(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only issuing organization accounts and staff can delete certificates',
      );
    }
    return this.certificateService.delete(id, user.organization_id);
  }

  @Post('template-issue/single')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Issuer] Direct single certificate issue from Template Generator',
    description: 'Generates JSON payload, pins JSON to IPFS, and registers certificate on Blockchain.',
  })
  async issueFromTemplateSingle(
    @Req() req: Request,
    @Body() dto: CreateCertificateDto,
  ) {
    const user = req.user as any;
    if (user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only issuing organization administrators can issue certificates',
      );
    }
    return this.certificateService.issueFromTemplateSingle(
      user.organization_id,
      dto,
      { id: user.id, name: user.name },
    );
  }

  @Post('template-issue/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Issuer] Direct batch certificate issue from Template Generator',
    description: 'Batch issues certificates from Template Generator, pinning JSON for each to IPFS and registering on Blockchain.',
  })
  async issueFromTemplateBatch(
    @Req() req: Request,
    @Body() dto: TemplateBatchIssueDto,
  ) {
    const user = req.user as any;
    if (user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only issuing organization administrators can issue certificates',
      );
    }
    return this.certificateService.issueFromTemplateBatch(
      user.organization_id,
      dto.rows,
      { id: user.id, name: user.name },
      dto.template_id,
    );
  }
}


