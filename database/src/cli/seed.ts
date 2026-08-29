import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppDataSource } from '../data-source.js';

interface ProductSeed {
  productId: string;
  name: string;
  description: string;
  price: number;
  availableStock: number;
  isFlashSaleActive: boolean;
}

async function seed(): Promise<void> {
  const seedPath = resolve(process.cwd(), 'doc/requirement/products-seed.json');
  const products = JSON.parse(await readFile(seedPath, 'utf8')) as ProductSeed[];

  try {
    await AppDataSource.initialize();
    await AppDataSource.transaction(async (manager) => {
      for (const product of products) {
        await manager.query(
          `
            INSERT INTO products (
              product_id, name, description, price,
              available_stock, remaining_stock, is_flash_sale_active
            ) VALUES ($1, $2, $3, $4, $5, $5, $6)
            ON CONFLICT (product_id) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              price = EXCLUDED.price,
              available_stock = EXCLUDED.available_stock,
              is_flash_sale_active = EXCLUDED.is_flash_sale_active,
              updated_at = CURRENT_TIMESTAMP
          `,
          [
            product.productId,
            product.name,
            product.description,
            product.price,
            product.availableStock,
            product.isFlashSaleActive,
          ],
        );
      }
    });

    console.log(`Seeded ${products.length} product(s) without resetting sold stock.`);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void seed();
