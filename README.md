# HorizonPC Finanzas

Plataforma full-stack en español para administrar las finanzas de una empresa de servicios IT. Permite registrar servicios y movimientos en **USD y CUP**, consultar indicadores mensuales/anuales y revisar reportes desde un panel responsive.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Recharts, Lucide React.
- **Backend:** Node.js, Express, PostgreSQL, JWT, bcrypt, express-validator.
- Consultas PostgreSQL parametrizadas, middleware de autenticación, CORS y manejo centralizado de errores.

## Requisitos

- Node.js 18+
- PostgreSQL 14+ (base de datos `postgres`)

El usuario PostgreSQL por defecto es `postgres` y la contraseña de desarrollo es `horizonpc`. Puedes cambiar cualquier valor mediante variables de entorno.

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

Para producción:

```bash
npm run build
npm start
```

`DATABASE_URL` tiene prioridad sobre las variables individuales (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`). Cambia `JWT_SECRET` y `CLIENT_URL` antes de desplegar.

## API principal

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
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
"esto es un cambio bobo"