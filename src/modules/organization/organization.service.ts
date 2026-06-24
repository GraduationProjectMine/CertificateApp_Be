import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IssuingOrganization } from '../../core/database/entities/issuing-organization.entity';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(IssuingOrganization)
    private readonly orgRepo: Repository<IssuingOrganization>,
  ) {}

  async create(
    organization_name: string,
    contact_email: string,
  ): Promise<IssuingOrganization> {
    const org = this.orgRepo.create({
      organization_name,
      contact_email,
      is_verified: false,
    });
    return this.orgRepo.save(org);
  }

  async findById(id: number): Promise<IssuingOrganization | undefined> {
    const org = await this.orgRepo.findOne({ where: { organization_id: id } });
    return org ?? undefined;
  }

  async findByEmail(email: string): Promise<IssuingOrganization | undefined> {
    const org = await this.orgRepo.findOne({ where: { contact_email: email } });
    return org ?? undefined;
  }
}