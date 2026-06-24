import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OcrModule } from './modules/ocr/ocr.module';
import { AuthModule } from './modules/auth/auth.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { IssuerModule } from './modules/issuer/issuer.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    OcrModule,
    AuthModule,
    SuperAdminModule,
    IssuerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
