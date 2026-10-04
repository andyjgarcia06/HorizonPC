import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const { Pool } = pg;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

// Supabase exige TLS incluso al ejecutar la aplicación en un entorno local.
const connectionString = process.env.DATABASE_URL;
const connectionUrl = connectionString ? new URL(connectionString) : null;
const databaseHost = connectionUrl
  ? connectionUrl.hostname
  : process.env.DB_HOST || 'localhost';
const isSupabase = databaseHost.endsWith('.supabase.co') || databaseHost.endsWith('.pooler.supabase.com');
const config = connectionUrl
  ? { connectionString: connectionUrl.toString() }
  : {
      host: databaseHost,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'horizonpc'
    };

if (connectionUrl) {
  for (const parameter of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) {
    connectionUrl.searchParams.delete(parameter);
  }
  config.connectionString = connectionUrl.toString();
}

if (isSupabase || process.env.DB_SSL === 'true') {
  const sslCaPath = process.env.DB_SSL_CA
    ? path.resolve(process.cwd(), process.env.DB_SSL_CA)
    : path.resolve(currentDirectory, '../../certs/prod-ca-2021.crt');
  if (isSupabase && !fs.existsSync(sslCaPath)) {
    throw new Error(`No se encontró el certificado SSL de Supabase en ${sslCaPath}. Configura DB_SSL_CA con una ruta válida.`);
  }
  config.ssl = {
    rejectUnauthorized: true,
    ...(fs.existsSync(sslCaPath) ? { ca: fs.readFileSync(sslCaPath, 'utf8') } : {})
  };
} else if (process.env.NODE_ENV === 'production') {
  config.ssl = { rejectUnauthorized: false };
} else {
  config.ssl = false;
}

export const pool = new Pool({
  ...config,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

pool.on('error', (error) => console.error('Error inesperado del pool PostgreSQL:', error));
