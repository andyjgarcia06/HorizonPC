CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  company VARCHAR(180) DEFAULT 'HorizonPC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permite conservar la tasa de cambio definida por cada cuenta.
ALTER TABLE users ADD COLUMN IF NOT EXISTS exchange_rate_cup NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (exchange_rate_cup >= 0);

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  description TEXT DEFAULT '',
  category VARCHAR(80) NOT NULL DEFAULT 'Consultoría',
  cost_usd NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  cost_cup NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost_cup >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo','Inactivo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('Ingreso','Gasto')),
  description VARCHAR(200) NOT NULL,
  amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_usd >= 0),
  amount_cup NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_cup >= 0),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS services_user_idx ON services(user_id);
CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions(user_id, transaction_date DESC);
