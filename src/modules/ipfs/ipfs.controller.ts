import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBody, ApiResponse, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { IpfsService } from './ipfs.service';
import { StoreCertificateDto, StoreCertificateResponseDto } from './ipfs.dto';

@ApiTags('ipfs')
@Controller('ipfs')
export class IpfsController {
  constructor(private readonly ipfsService: IpfsService) {}

  @Post('upload-file')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload binary file (image, PDF, diploma scan) directly to IPFS',
    description:
      'Pins the uploaded binary file directly to IPFS via Pinata API and calculates its SHA-3 hash, returning the CID and gateway URL.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload to IPFS (image, pdf, etc.)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File successfully uploaded and pinned to IPFS',
  })
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileName = file.originalname || `file_${Date.now()}`;
    return this.ipfsService.storeFileToIpfs(
      file.buffer,
      fileName,
      file.mimetype,
    );
  }

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
