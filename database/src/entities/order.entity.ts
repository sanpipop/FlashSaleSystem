import { Check, Column, Entity, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'orders' })
@Unique('uq_orders_job_id', ['jobId'])
@Unique('unique_user_product', ['userId', 'productId'])
@Check('chk_orders_status_success', "status = 'SUCCESS'")
export class OrderEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'job_id', type: 'varchar', length: 128 })
  jobId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ name: 'product_id', type: 'varchar', length: 64 })
  productId!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: 'SUCCESS';

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
