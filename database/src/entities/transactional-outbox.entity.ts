import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'transactional_outbox' })
@Check('chk_outbox_event_type', "event_type = 'PRODUCT_STOCK_CHANGED'")
export class TransactionalOutboxEntity {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'aggregate_id', type: 'varchar', length: 64 })
  aggregateId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType!: 'PRODUCT_STOCK_CHANGED';

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz' })
  nextAttemptAt!: Date;
}
