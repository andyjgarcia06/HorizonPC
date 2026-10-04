import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET?.trim();
const insecureJwtSecrets = new Set([
  'cambia-esta-clave-en-produccion',
  'desarrollo-horizonpc',
  'replace-this-with-a-random-secret'
]);

if (!jwtSecret || jwtSecret.length < 32 || insecureJwtSecrets.has(jwtSecret.toLowerCase())) {
  throw new Error('JWT_SECRET es obligatorio y debe tener al menos 32 caracteres aleatorios.');
}

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.trim()) {
  throw new Error('DATABASE_URL es obligatoria en producción.');
}

const configuredClientUrls = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && configuredClientUrls.length === 0) {
  throw new Error('CLIENT_URL es obligatorio en producción.');
}

export const clientOrigins = new Set(
  (configuredClientUrls.length ? configuredClientUrls : ['http://localhost:5173']).map((value) => {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error('CLIENT_URL debe contener uno o varios orígenes HTTP(S) válidos.');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('CLIENT_URL debe contener solo orígenes HTTP(S), separados por comas.');
    }
    return url.origin;
  })
);

export { jwtSecret };
