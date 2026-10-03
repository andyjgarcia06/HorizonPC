import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();
const { Pool } = pg;

// Supabase exige TLS incluso al ejecutar la aplicación en un entorno local.
const connectionString = process.env.DATABASE_URL;
const databaseHost = connectionString
  ? new URL(connectionString).hostname
  : process.env.DB_HOST || 'localhost';
const isSupabase = databaseHost.endsWith('.supabase.co') || databaseHost.endsWith('.pooler.supabase.com');
const config = connectionString
  ? { connectionString }
  : {
      host: databaseHost,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'horizonpc'
    };

if (isSupabase || process.env.DB_SSL === 'true') {
  const sslCaPath = process.env.DB_SSL_CA;
  if (isSupabase && !sslCaPath) {
    throw new Error('Configura DB_SSL_CA con el certificado raíz descargado desde Supabase Database Settings.');
  }
  config.ssl = {
    rejectUnauthorized: true,
    ...(sslCaPath ? { ca: fs.readFileSync(path.resolve(sslCaPath), 'utf8') } : {})
  };
} else if (process.env.NODE_ENV === 'production') {
  config.ssl = { rejectUnauthorized: false };
} else {
  config.ssl = false;
}

export const pool = new Pool(config);

pool.on('error', (error) => console.error('Error inesperado del pool PostgreSQL:', error));
