import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config.js';

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Token de autenticación requerido.' });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión expirada. Inicia sesión nuevamente.' });
  }
}
