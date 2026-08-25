import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BatchesService } from './batches.service';
import { CreateIssuanceBatchDto } from './dto/batch.dto';

@ApiTags('issuance-batches')
@ApiBearerAuth()
@Controller('issuance-batches')
@UseGuards(JwtAuthGuard)
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get()
  @ApiOperation({ summary: 'List issuance batches' })
  findAll(@Req() req: AuthenticatedRequest) {
    const user = this.requireOrganizationUser(req);
    return this.batches.findAll(user.organization_id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get batch progress and row results' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = this.requireOrganizationUser(req);
    return this.batches.findOne(id, user.organization_id);
  }

  @Post()
  @ApiOperation({
    summary: 'Import rows as DRAFT or issue certificates',
    description:
      'mode=DRAFT_ONLY (staff) creates drafts only. mode=FULL (issuer) creates and approves.',
  })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateIssuanceBatchDto) {
    const user = req.user;
    const mode = dto.mode || 'FULL';
    if (mode === 'FULL' && user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only issuing organization administrators can issue a batch. Staff must use DRAFT_ONLY mode.',
      );
    }
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only organization accounts can create batches',
      );
    }
    return this.batches.create(
      user.organization_id,
      { id: user.id, name: user.name },
      dto.name,
      dto.rows,
      mode,
    );
  }

  @Post(':batchId/items/:itemId/retry')
  @ApiOperation({ summary: 'Retry one failed batch row' })
  retry(
    @Req() req: AuthenticatedRequest,
    @Param('batchId') batchId: string,
    @Param('itemId') itemId: string,
  ) {
    const user = req.user;
    if (user.role !== 'issuer') {
      throw new ForbiddenException(
        'Only issuing organization administrators can retry batch rows',
      );
    }
    return this.batches.retryItem(batchId, itemId, user.organization_id, {
      id: user.id,
      name: user.name,
    });
  }

  private requireOrganizationUser(req: AuthenticatedRequest) {
    const user = req.user;
    if (user.role !== 'issuer' && user.role !== 'staff') {
      throw new ForbiddenException(
        'Only organization accounts can view issuance batches',
      );
    }
    return user;
  }
}
