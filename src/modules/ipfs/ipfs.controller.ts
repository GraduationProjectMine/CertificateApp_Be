import {
  Controller,
  Post,
  Body,
  BadRequestException,
  ForbiddenException,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBody, ApiResponse, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IpfsService } from './ipfs.service';
import { StoreCertificateDto, StoreCertificateResponseDto } from './ipfs.dto';

@ApiTags('ipfs')
@Controller('ipfs')
@UseGuards(JwtAuthGuard)
export class IpfsController {
  constructor(private readonly ipfsService: IpfsService) {}

  @Post('upload-file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
        const allowedExtensions = /\.(pdf|jpe?g|png)$/i;
        if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.test(file.originalname || '')) {
          callback(new BadRequestException('Chỉ hỗ trợ file định dạng PDF, JPG hoặc PNG'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
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
  async uploadFile(@Req() req: Request, @UploadedFile() file: any) {
    const user = req.user as any;
    if (user?.role !== 'staff' && user?.role !== 'issuer') {
      throw new ForbiddenException('Chỉ tài khoản nhân viên hoặc người phát hành mới có quyền upload file văn bằng');
    }
    if (!file) {
      throw new BadRequestException('Không tìm thấy file upload');
    }

    const header = file.buffer.subarray(0, 8).toString('hex');
    const isPdf = file.mimetype === 'application/pdf' && header.startsWith('25504446');
    const isPng = file.mimetype === 'image/png' && header === '89504e470d0a1a0a';
    const isJpeg = file.mimetype === 'image/jpeg' && header.startsWith('ffd8ff');
    if (!isPdf && !isPng && !isJpeg) {
      throw new BadRequestException('Nội dung thực tế của file không khớp với định dạng khai báo');
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
