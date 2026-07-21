import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
}

export class BatchListQueryDto {
  @IsString()
  @IsOptional()
  status?: string;
}
