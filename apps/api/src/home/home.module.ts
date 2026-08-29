import { Module } from '@nestjs/common';
import { HomeController } from './home.controller.js';
import { HomePageService } from './home-page.service.js';

@Module({
  controllers: [HomeController],
  providers: [HomePageService],
})
export class HomeModule {}
