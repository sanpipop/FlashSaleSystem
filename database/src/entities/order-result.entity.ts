import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

export type OrderResultStatus =
  | 'SUCCESS'
  | 'REJECTED_SOLD_OUT'
  | 'REJECTED_INACTIVE'
  | 'REJECTED_DUPLICATE';

@Entity({ name: 'order_results' })
@Check(
  'chk_order_results_status',
  "status IN ('SUCCESS', 'REJECTED_SOLD_OUT', 'REJECTED_INACTIVE', 'REJECTED_DUPLICATE')",
)
@Check(
  'result_order_consistency',
  "(status = 'SUCCESS' AND order_id IS NOT NULL) OR (status <> 'SUCCESS' AND order_id IS NULL)",
)
export class OrderResultEntity {
  @PrimaryColumn({ name: 'job_id', type: 'varchar', length: 128 })
  jobId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ name: 'product_id', type: 'varchar', length: 64 })
  productId!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: OrderResultStatus;

  @Column({ name: 'order_id', type: 'varchar', length: 64, nullable: true })
  orderId!: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;

  @Column({ type: 'text' })
  message!: string;
}
