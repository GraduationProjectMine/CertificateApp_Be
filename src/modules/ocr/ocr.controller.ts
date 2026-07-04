import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { OcrService } from './ocr.service';
import { DiplomaParserService } from './diploma-parser.service';
import { OcrResponseDto, DiplomaExtractionResponseDto } from './ocr.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const SUPPORTED_LANGUAGES = {
  eng: 'English',
  vie: 'Vietnamese',
  fra: 'French',
  deu: 'German',
  spa: 'Spanish',
  jpn: 'Japanese',
  chi_sim: 'Chinese (Simplified)',
  chi_tra: 'Chinese (Traditional)',
};

@ApiTags('ocr')
@ApiBearerAuth()
@Controller('ocr')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(
    private readonly ocrService: OcrService,
    private readonly diplomaParserService: DiplomaParserService,
  ) {}

  @Get('supported-languages')
  @ApiResponse({
    status: 200,
    description: 'List of supported languages for OCR',
  })
  getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
  }

  @Post('extract-text')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to extract text from',
        },
        language: {
          type: 'string',
          description:
            'Language code (eng: English, vie: Vietnamese, fra: French, deu: German, etc.)',
          default: 'eng',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Text successfully extracted from image',
    type: OcrResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or request',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only organization admins and staff can use OCR',
  })
  async extractText(
    @Req() req: Request,
    @UploadedFile() file: any,
    @Query('language') language: string = 'eng',
  ): Promise<OcrResponseDto> {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException('Only issuing organization accounts and staff can use OCR');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`,
      );
    }

    const supportedLanguages = Object.keys(SUPPORTED_LANGUAGES);
    if (!supportedLanguages.includes(language)) {
      throw new BadRequestException(
        `Unsupported language. Supported languages: ${supportedLanguages.join(', ')}`,
      );
    }

    return this.ocrService.extractTextFromImage(file.buffer, language);
  }

  @Post('extract-diploma')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Diploma image file to extract data from',
        },
        language: {
          type: 'string',
          description: 'Language code (default: vie for Vietnamese)',
          default: 'vie',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Diploma data successfully extracted and parsed',
    type: DiplomaExtractionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or request',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only organization admins and staff can use OCR',
  })
  async extractDiploma(
    @Req() req: Request,
    @UploadedFile() file: any,
    @Query('language') language: string = 'vie',
  ): Promise<DiplomaExtractionResponseDto> {
    const user = req.user as any;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException('Only issuing organization accounts and staff can use OCR');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`,
      );
    }

    const supportedLanguages = Object.keys(SUPPORTED_LANGUAGES);
    if (!supportedLanguages.includes(language)) {
      throw new BadRequestException(
        `Unsupported language. Supported languages: ${supportedLanguages.join(', ')}`,
      );
    }

    const ocrResult = await this.ocrService.extractTextFromImage(
      file.buffer,
      language,
    );

    const { data, errors } = this.diplomaParserService.parse(
      ocrResult.extractedText,
    );

    return {
      data,
      accuracy: ocrResult.accuracy,
      rawText: ocrResult.extractedText,
      validationErrors: Object.keys(errors).length > 0 ? errors : undefined,
    };
  }
}
