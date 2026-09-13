import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { pool } from './pool.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const currentFile = fileURLToPath(import.meta.url);
const schemaPath = path.join(path.dirname(currentFile), 'schema.sql');

try {
  await pool.query(fs.readFileSync(schemaPath, 'utf8'));
  console.log('Base de datos inicializada correctamente.');
} catch (error) {
  console.error('No se pudo inicializar la base de datos:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
