import { Injectable } from '@nestjs/common';
import type { ProductResponseItem, ProductsResponse } from '@flash-sale/contracts';
import { ProductEntity } from '@flash-sale/database';
import { DatabaseService } from '../common/database.service.js';
import { ProductsCacheService } from './products-cache.service.js';
import type { ProductsQueryDto } from './products.dto.js';

@Injectable()
export class ProductsService {
  private readonly inFlightProductLookups = new Map<string, Promise<ProductEntity | null>>();

  constructor(
    private readonly database: DatabaseService,
    private readonly cache: ProductsCacheService,
  ) {}

  async list(query: ProductsQueryDto): Promise<ProductsResponse> {
    return this.cache.getOrLoad(query, () => this.listFromDatabase(query));
  }

  private async listFromDatabase(query: ProductsQueryDto): Promise<ProductsResponse> {
    const repository = this.database.dataSource.getRepository(ProductEntity);
    const [products, total] = await repository.findAndCount({
      order: { createdAt: 'ASC', productId: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      status: 'success',
      data: products.map((product) => this.toResponse(product)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(productId: string): Promise<ProductEntity | null> {
    const existing = this.inFlightProductLookups.get(productId);
    if (existing) {
      return existing;
    }

    const lookup = this.database.dataSource.getRepository(ProductEntity).findOneBy({ productId });
    this.inFlightProductLookups.set(productId, lookup);

    try {
      return await lookup;
    } finally {
      if (this.inFlightProductLookups.get(productId) === lookup) {
        this.inFlightProductLookups.delete(productId);
      }
    }
  }

  private toResponse(product: ProductEntity): ProductResponseItem {
    return {
      productId: product.productId,
      name: product.name,
      price: product.price,
      availableStock: product.availableStock,
      remainingStock: product.remainingStock,
      isFlashSaleActive: product.isFlashSaleActive,
    };
  }
}
