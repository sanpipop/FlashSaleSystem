import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

const numericTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => Number(value),
};

@Entity({ name: 'products' })
@Check('chk_products_price_non_negative', 'price >= 0')
@Check('chk_products_available_stock_non_negative', 'available_stock >= 0')
@Check('chk_products_remaining_stock_non_negative', 'remaining_stock >= 0')
export class ProductEntity {
  @PrimaryColumn({ name: 'product_id', type: 'varchar', length: 64 })
  productId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  price!: number;

  @Column({ name: 'available_stock', type: 'integer' })
  availableStock!: number;

  @Column({ name: 'remaining_stock', type: 'integer' })
  remainingStock!: number;

  @Column({ name: 'is_flash_sale_active', type: 'boolean', default: true })
  isFlashSaleActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
