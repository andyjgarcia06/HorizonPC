import jwt from 'jsonwebtoken';

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Token de autenticación requerido.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'desarrollo-horizonpc');
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión expirada. Inicia sesión nuevamente.' });
  }
}
