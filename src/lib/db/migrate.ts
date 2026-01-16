import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const runMigrations = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  // Remove pgbouncer param if present (not supported by postgres.js for migrations)
  const connectionString = process.env.DATABASE_URL.replace(/\?.*$/, '');

  const connection = postgres(connectionString, { max: 1 });
  const db = drizzle(connection);

  console.log('Running migrations...');

  await migrate(db, { migrationsFolder: './drizzle/migrations' });

  console.log('Migrations completed!');

  await connection.end();
  process.exit(0);
};

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
