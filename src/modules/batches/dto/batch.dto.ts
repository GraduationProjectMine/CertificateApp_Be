import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateCertificateDto } from '../../certificate/dto/certificate.dto';

export class CreateIssuanceBatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateCertificateDto)
  rows!: CreateCertificateDto[];

  @IsString()
  @IsOptional()
  @IsIn(['DRAFT_ONLY', 'FULL'])
  mode?: 'DRAFT_ONLY' | 'FULL';
}

export class BatchListQueryDto {
  @IsString()
  @IsOptional()
  status?: string;
}
