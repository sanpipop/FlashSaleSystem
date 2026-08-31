import { Injectable } from '@nestjs/common';
import type { ProductResponseItem, ProductsResponse } from '@flash-sale/contracts';
import { ProductEntity } from '@flash-sale/database';
import { DatabaseService } from '../common/database.service.js';
import { ProductsCacheService } from './products-cache.service.js';
import type { ProductsQueryDto } from './products.dto.js';

const MAX_CACHE_ENTRIES = 128;

interface CachedProductLookup {
  product: ProductEntity | null;
  expiresAt: number;
}

@Injectable()
export class ProductsService {
  private readonly memoryCache = new Map<string, CachedProductLookup>();
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

  async findById(productId: string, ttlMs: number = 5_000): Promise<ProductEntity | null> {
    const now = Date.now();
    const cached = this.memoryCache.get(productId);
    if (cached) {
      if (cached.expiresAt > now) {
        if (ttlMs > 0) {
          return cached.product;
        }
      } else {
        this.memoryCache.delete(productId);
      }
    }

    const existing = this.inFlightProductLookups.get(productId);
    if (existing) {
      return existing;
    }

    const lookup = (async (): Promise<ProductEntity | null> => {
      try {
        const product = await this.database.dataSource.getRepository(ProductEntity).findOneBy({ productId });
        this.setInCache(productId, product, ttlMs);
        return product;
      } finally {
        this.inFlightProductLookups.delete(productId);
      }
    })();

    this.inFlightProductLookups.set(productId, lookup);
    return lookup;
  }

  private setInCache(productId: string, product: ProductEntity | null, ttlMs: number): void {
    if (ttlMs <= 0) {
      return;
    }

    const now = Date.now();
    if (this.memoryCache.size >= MAX_CACHE_ENTRIES) {
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expiresAt <= now) {
          this.memoryCache.delete(key);
        }
      }
    }

    if (this.memoryCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(productId, {
      product,
      expiresAt: now + ttlMs,
    });
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
