# Horizon Finanzas

Plataforma full-stack en español para administrar las finanzas de una empresa de servicios IT. Permite registrar servicios y movimientos en **USD y CUP**, consultar indicadores mensuales/anuales y revisar reportes desde un panel responsive.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Recharts, Lucide React.
- **Backend:** Node.js, Express, PostgreSQL, JWT, bcrypt, express-validator.
- Consultas PostgreSQL parametrizadas, middleware de autenticación, CORS y manejo centralizado de errores.

## Requisitos

- Node.js 20+
- PostgreSQL 14+; también es compatible con Supabase PostgreSQL.

La conexión se configura en `server/.env`. Para este despliegue se usa el pooler compartido de Supabase en modo transacción (compatible con redes IPv4): host, puerto y usuario están incluidos en `server/.env.example`. Sustituye `YOUR-PASSWORD` en `DATABASE_URL` por la contraseña actual de la base de datos (codifica caracteres especiales para URL), y descarga el certificado raíz del proyecto desde Supabase Dashboard > Database > Settings > SSL Configuration. Guárdalo como `server/certs/prod-ca-2021.crt` y conserva `DB_SSL=true` y `DB_SSL_CA=certs/prod-ca-2021.crt`. No guardes la URL real con contraseña en archivos versionados ni en variables del frontend.

## Instalación y ejecución

```bash
cp .env.example server/.env
cp client/.env.example client/.env
npm install
npm run install:all
cd server
npm run db:init
cd ..
npm run dev
```

La aplicación queda disponible en `http://localhost:5173` y la API en `http://localhost:4000`. En Windows PowerShell puedes copiar los archivos `.env.example` manualmente si no usas `cp`.

Para desarrollo local, configura `JWT_SECRET` con una clave aleatoria de al menos 32 caracteres en `server/.env`. Puedes generarla con:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

El registro protege contra bots con Cloudflare Turnstile. Configura `VITE_TURNSTILE_SITE_KEY` en `client/.env` con la clave pública del widget y `TURNSTILE_SECRET_KEY` en `server/.env` con la clave secreta. En Cloudflare, permite los dominios del frontend (incluido `localhost` para desarrollo). Tras registrarse correctamente, la cuenta inicia sesión automáticamente; no se envía correo de verificación. No se necesita una migración de base de datos; si la base conserva columnas de una versión anterior para verificación de correo, la aplicación ya no las utiliza.

## Despliegue del backend en Render

El archivo `render.yaml` configura el servicio web del backend con `server` como directorio raíz, `npm ci` como comando de compilación, `npm start` como comando de inicio y `/api/health` como health check. Crea el Blueprint en Render desde el repositorio y completa estas variables secretas/privadas cuando Render las solicite:

- `DATABASE_URL`: cadena de conexión del pooler de Supabase.
- `JWT_SECRET`: Render genera y conserva un valor aleatorio seguro al crear el Blueprint. No lo incluyas en Git.
- `CLIENT_URL`: origen HTTPS exacto del frontend desplegado. Se admiten varios orígenes separados por comas.
- `TURNSTILE_SECRET_KEY`: clave secreta del widget de Cloudflare Turnstile.

El certificado de Supabase se incluye en el repositorio en `server/certs/prod-ca-2021.crt`; el Blueprint configura la ruta `DB_SSL_CA`. Render asigna `PORT` automáticamente. El health check prueba la conexión a PostgreSQL además de que la API esté levantada.

En un servicio Render ya creado, conserva `TURNSTILE_SECRET_KEY` y elimina, si las habías agregado, las variables `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `RESEND_API_KEY` y `EMAIL_FROM`, que ya no se usan. Despliega el frontend por separado y define `VITE_API_URL` durante su build con la URL pública de la API terminada en `/api` (por ejemplo, `https://horizonpc-api.onrender.com/api`) y `VITE_TURNSTILE_SITE_KEY` con la clave pública del widget. Vercel necesita un nuevo deploy después de configurar esas variables. A su vez, configura `CLIENT_URL` en el servicio de backend con el origen público del frontend, sin `/api` ni rutas.

`DATABASE_URL` tiene prioridad sobre las variables individuales (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`). El backend exige un `JWT_SECRET` fuerte y `CLIENT_URL` en producción; también limita a 10 los intentos combinados de inicio de sesión/registro por IP cada 15 minutos. El limitador usa memoria local, por lo que al escalar a varias instancias se recomienda configurarle un almacén compartido.

El backend activa TLS y verifica el certificado raíz indicado por `DB_SSL_CA` para Supabase. En el pooler compartido, el puerto `6543` es modo transacción; esta API usa consultas independientes y no utiliza sentencias preparadas con nombre. Copia exactamente host y usuario que aparecen en Supabase > Connect; no reutilices el host ni el usuario de la conexión directa.

## API principal

- `POST /api/auth/register` (requiere token válido de Turnstile), `POST /api/auth/login`, `GET /api/auth/me`
- `PATCH /api/auth/profile` (requiere contraseña actual para confirmar los cambios)
- `GET|POST|PATCH /api/services`
- `GET|POST /api/transactions`
- `GET /api/dashboard`

Los endpoints de negocio requieren `Authorization: Bearer <token>`. Todas las operaciones se filtran por el usuario autenticado.

## Estructura

```text
client/src/       Aplicación React, contexto de sesión en localStorage, vistas y estilos
server/src/       API Express, rutas, middleware y conexión PostgreSQL
server/src/db/    Esquema SQL e inicialización
```
