import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

// DATABASE_URL es útil en despliegues; las variables individuales facilitan el desarrollo local.
export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'horizonPC',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'horizonpc'
      }
);

pool.on('error', (error) => console.error('Error inesperado del pool PostgreSQL:', error));
