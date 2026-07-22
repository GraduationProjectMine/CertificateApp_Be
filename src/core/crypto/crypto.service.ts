import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production';
    this.key = crypto.scryptSync(secret, 'certichain-salt', 32);
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(encoded: string): string {
    try {
      const parts = encoded.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
      }
      const [ivHex, authTagHex, encrypted] = parts;
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      throw new InternalServerErrorException('Failed to decrypt organization wallet key');
    }
  }
}
