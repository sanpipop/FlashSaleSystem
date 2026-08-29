import { Controller, Get, Header } from '@nestjs/common';
import { HomePageService } from './home-page.service.js';

@Controller()
export class HomeController {
  constructor(private readonly homePageService: HomePageService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getHomePage(): string {
    return this.homePageService.renderHomePageHtml();
  }
}
