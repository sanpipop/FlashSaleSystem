import { AppDataSource } from '@flash-sale/database';
import { InitialSchema1760000000000 } from '@flash-sale/database/dist/migrations/1760000000000-initial-schema.js';
import { PlaceOrderBatch1760000001000 } from '@flash-sale/database/dist/migrations/1760000001000-place-order-batch.js';
import { FixPlaceOrderBatch1760000002000 } from '@flash-sale/database/dist/migrations/1760000002000-fix-place-order-batch.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const schema = 'it_migration_rollback';
type DatabaseQueryRunner = ReturnType<typeof AppDataSource.createQueryRunner>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function functionExists(queryRunner: DatabaseQueryRunner): Promise<boolean> {
  const value: unknown = await queryRunner.query(
    `SELECT to_regprocedure('${schema}.place_order_batch(jsonb)') IS NOT NULL AS exists`,
  );
  if (!Array.isArray(value)) {
    return false;
  }
  const rows = value as unknown[];
  const row: unknown = rows[0];
  return isRecord(row) && row['exists'] === true;
}

describe('place_order_batch migration rollback', () => {
  let queryRunner: DatabaseQueryRunner;

  beforeAll(async () => {
    await AppDataSource.initialize();
    queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`CREATE SCHEMA ${schema}`);
    await queryRunner.query(`SET search_path TO ${schema}, public`);
    await new InitialSchema1760000000000().up(queryRunner);
    await new PlaceOrderBatch1760000001000().up(queryRunner);
    await new FixPlaceOrderBatch1760000002000().up(queryRunner);
  });

  afterAll(async () => {
    await queryRunner.query('RESET search_path');
    await queryRunner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await queryRunner.release();
    await AppDataSource.destroy();
  });

  it('restores the migration-1 function after rolling back migration 2', async () => {
    const migrationTwo = new FixPlaceOrderBatch1760000002000();

    expect(await functionExists(queryRunner)).toBe(true);
    await migrationTwo.down(queryRunner);
    expect(await functionExists(queryRunner)).toBe(true);
    await expect(
      queryRunner.query(`SELECT * FROM ${schema}.place_order_batch('[]'::jsonb)`),
    ).resolves.toEqual([]);

    await migrationTwo.up(queryRunner);
    expect(await functionExists(queryRunner)).toBe(true);
  });
});
