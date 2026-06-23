import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffAccount } from '../../core/database/entities/staff-account.entity';

@Injectable()
export class IssuerService {
  constructor(
    @InjectRepository(StaffAccount)
    private readonly staffRepo: Repository<StaffAccount>,
  ) {}

  async create(
    name: string,
    email: string,
    hashedPassword: string,
    organization_id: number,
  ): Promise<Omit<StaffAccount, 'password'>> {
    const staff = this.staffRepo.create({
      name,
      email,
      password: hashedPassword,
      organization_id,
      role: 'Staff',
      status: 'Active',
    });
    const saved = await this.staffRepo.save(staff);
    const { password, ...result } = saved;
    return result;
  }

  async findByEmail(email: string): Promise<StaffAccount | undefined> {
    const staff = await this.staffRepo.findOne({ where: { email } });
    return staff ?? undefined;
  }

  async findById(id: number): Promise<Omit<StaffAccount, 'password'> | undefined> {
    const staff = await this.staffRepo.findOne({ where: { staff_id: id } });
    if (!staff) return undefined;
    const { password, ...result } = staff;
    return result;
  }
}