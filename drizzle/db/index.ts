import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL
const isServerless = process.env.DB_SERVERLESS === 'true';

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const client = postgres(connectionString, {
  // Connection pool size, serverless: 1, traditional: 10 (default) or more
  max: isServerless ? 1 : 10,
  // Prepared statements
  prepare: !isServerless,
})

export const db = drizzle(client)