import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OcrModule } from './modules/ocr/ocr.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [OcrModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
