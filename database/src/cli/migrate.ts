import { AppDataSource } from '../data-source.js';

async function migrate(): Promise<void> {
  try {
    await AppDataSource.initialize();
    const migrations = await AppDataSource.runMigrations({ transaction: 'all' });
    console.log(`Applied ${migrations.length} migration(s).`);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void migrate();
