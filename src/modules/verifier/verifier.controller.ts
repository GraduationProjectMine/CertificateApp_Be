import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { VerifierService } from './verifier.service';
import { VerifyQueryDto } from './dto/verify-query.dto';

@ApiTags('verifier')
@Controller('verifier')
export class VerifierController {
  constructor(private readonly verifierService: VerifierService) {}

  @Get('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Verify a certificate using its codes (serial and registry numbers)',
    description:
      'Publicly accessible endpoint (no login required) to verify if a certificate is valid, matches the blockchain registry, and retrieves the original data stored on IPFS.',
  })
  @ApiQuery({
    name: 'serialNumber',
    type: String,
    required: true,
    description: 'Serial number (Số hiệu)',
  })
  @ApiQuery({
    name: 'registryNumber',
    type: String,
    required: true,
    description: 'Registry number (Số vào sổ cấp bằng)',
  })
  @ApiResponse({
    status: 200,
    description: 'Certificate verification completed successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Missing query parameters or invalid request.',
  })
  @ApiResponse({
    status: 404,
    description: 'Certificate not found with the provided codes.',
  })
  async verify(@Query() query: VerifyQueryDto) {
    return this.verifierService.verifyCertificate(
      query.serialNumber,
      query.registryNumber,
    );
  }

  @Get('certificate/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get certificate details by ID publicly',
    description:
      'Retrieve certificate details and validation state by its UUID/ID without authentication.',
  })
  async getCertificateById(@Param('id') id: string) {
    return this.verifierService.getCertificateById(id);
  }

  @Get('verify-online')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Verify an online certificate (issued via template) using serial and registry numbers',
    description:
      'Publicly verify if an online certificate matches blockchain and IPFS.',
  })
  async verifyOnline(@Query() query: VerifyQueryDto) {
    return this.verifierService.verifyOnlineCertificate(
      query.serialNumber,
      query.registryNumber,
    );
  }

  @Get('online-certificate/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get online certificate details by ID publicly',
    description:
      'Retrieve online certificate details and validation state by UUID.',
  })
  async getOnlineCertificateById(@Param('id') id: string) {
    return this.verifierService.getOnlineCertificateById(id);
  }

  @Post('scan-ocr')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Public OCR scan of a diploma image to extract serial and registry numbers',
    description:
      'Scans a diploma image taken by camera or selected from device files and extracts serial and registry numbers for public verification.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Diploma image file (PNG, JPG, WEBP)',
        },
      },
      required: ['file'],
    },
  })
  async scanOcr(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    return this.verifierService.scanDiplomaOcr(file);
  }
}
