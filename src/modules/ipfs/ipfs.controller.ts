import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBody, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { IpfsService } from './ipfs.service';
import { StoreCertificateDto, StoreCertificateResponseDto } from './ipfs.dto';

@ApiTags('ipfs')
@Controller('ipfs')
export class IpfsController {
  constructor(private readonly ipfsService: IpfsService) {}

  @Post('store-certificate')
  @ApiOperation({
    summary: 'Store certificate extracted text to IPFS',
    description:
      'Calculates the SHA-3 hash of the certificate data and uploads both the data and hash to IPFS using Pinata API, returning the CID.',
  })
  @ApiBody({
    type: StoreCertificateDto,
    description: 'The extracted data fields of the certificate to store.',
  })
  @ApiResponse({
    status: 201,
    description: 'Successfully uploaded to IPFS and pinned',
    type: StoreCertificateResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 500,
    description:
      'Failed to upload to IPFS due to Pinata API or environment configuration issues',
  })
  async storeCertificate(
    @Body() body: StoreCertificateDto,
  ): Promise<StoreCertificateResponseDto> {
    // Validate that all required properties are present
    const requiredFields: Array<keyof StoreCertificateDto> = [
      'documentTitle',
      'fullName',
      'dob',
      'placeOfBirth',
      'gender',
      'ethnicity',
      'schoolName',
      'examCohort',
      'examBoard',
      'issueLocation',
      'issueDate',
      'serialNumber',
      'registryNumber',
    ];

    const missingFields = requiredFields.filter((field) => !body[field]);

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Missing required fields: ${missingFields.join(', ')}`,
      );
    }

    return this.ipfsService.storeToIpfs(body);
  }
}
