import { Injectable } from '@nestjs/common';

export interface User {
  id: number;
  email: string;
  username: string;
  password: string;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  private users: User[] = [];
  private nextId = 1;

  async create(email: string, username: string, hashedPassword: string): Promise<Omit<User, 'password'>> {
    const user: User = {
      id: this.nextId++,
      email,
      username,
      password: hashedPassword,
      createdAt: new Date(),
    };
    this.users.push(user);
    const { password, ...result } = user;
    return result;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.users.find((u) => u.email === email);
  }

  async findById(id: number): Promise<Omit<User, 'password'> | undefined> {
    const user = this.users.find((u) => u.id === id);
    if (!user) return undefined;
    const { password, ...result } = user;
    return result;
  }
}