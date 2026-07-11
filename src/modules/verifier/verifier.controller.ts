import { Controller, Get, Query, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { VerifierService } from './verifier.service';
import { VerifyQueryDto } from './dto/verify-query.dto';

@ApiTags('verifier')
@Controller('verifier')
export class VerifierController {
  constructor(private readonly verifierService: VerifierService) {}

  @Get('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a certificate using its codes (serial and registry numbers)',
    description:
      'Publicly accessible endpoint (no login required) to verify if a certificate is valid, matches the blockchain registry, and retrieves the original data stored on IPFS.',
  })
  @ApiQuery({ name: 'serialNumber', type: String, required: true, description: 'Serial number (Số hiệu)' })
  @ApiQuery({ name: 'registryNumber', type: String, required: true, description: 'Registry number (Số vào sổ cấp bằng)' })
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
    description: 'Retrieve certificate details and validation state by its UUID/ID without authentication.',
  })
  async getCertificateById(@Param('id') id: string) {
    return this.verifierService.getCertificateById(id);
  }
}
