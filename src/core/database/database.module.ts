import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IssuingOrganization } from './entities/issuing-organization.entity';
import { StaffAccount } from './entities/staff-account.entity';
import { StudentAccount } from './entities/student-account.entity';
import { Certificate } from './entities/certificate.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_NAME', 'certificate_app'),
        entities: [IssuingOrganization, StaffAccount, StudentAccount, Certificate],
        synchronize: config.get<string>('DB_SYNC', 'false') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([
      IssuingOrganization,
      StaffAccount,
      StudentAccount,
      Certificate,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}