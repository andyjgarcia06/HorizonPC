import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { clientOrigins } from './config.js';
import { pool } from './db/pool.js';
import authRoutes from './routes/auth.js';
import serviceRoutes from './routes/services.js';
import transactionRoutes from './routes/transactions.js';
import dashboardRoutes from './routes/dashboard.js';
import { notFound, errorHandler } from './middleware/errors.js';

dotenv.config();
const app = express();
const port = Number(process.env.PORT || 4000);
app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || clientOrigins.has(origin)) return callback(null, true);
    const error = new Error('Origen no autorizado por CORS.');
    error.status = 403;
    return callback(error);
  }
}));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'HorizonPC API' });
  } catch (error) {
    next(error);
  }
});
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use(notFound);
app.use(errorHandler);
app.listen(port, () => console.log(`HorizonPC API escuchando en http://localhost:${port}`));
