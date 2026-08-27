import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductsCacheService } from './products-cache.service.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [ProductsController],
  providers: [ProductsCacheService, ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
