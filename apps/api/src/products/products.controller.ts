import { Controller, Get, Query } from '@nestjs/common';
import type { ProductsResponse } from '@flash-sale/contracts';
import { ProductsQueryDto } from './products.dto.js';
import { ProductsService } from './products.service.js';

@Controller('api/v1/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: ProductsQueryDto): Promise<ProductsResponse> {
    return this.productsService.list(query);
  }
}
