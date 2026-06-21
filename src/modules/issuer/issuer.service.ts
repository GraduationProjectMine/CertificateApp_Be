import { Injectable } from '@nestjs/common';

export interface Issuer {
  id: number;
  email: string;
  username: string;
  password: string;
  role: 'issuer';
  createdAt: Date;
}

@Injectable()
export class IssuerService {
  private issuers: Issuer[] = [];
  private nextId = 1;

  async create(email: string, username: string, hashedPassword: string): Promise<Omit<Issuer, 'password'>> {
    const issuer: Issuer = {
      id: this.nextId++,
      email,
      username,
      password: hashedPassword,
      role: 'issuer',
      createdAt: new Date(),
    };
    this.issuers.push(issuer);
    const { password, ...result } = issuer;
    return result;
  }

  async findByEmail(email: string): Promise<Issuer | undefined> {
    return this.issuers.find((u) => u.email === email);
  }

  async findById(id: number): Promise<Omit<Issuer, 'password'> | undefined> {
    const issuer = this.issuers.find((u) => u.id === id);
    if (!issuer) return undefined;
    const { password, ...result } = issuer;
    return result;
  }
}