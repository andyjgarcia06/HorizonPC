export function notFound(req, res) {
  res.status(404).json({ message: 'Recurso no encontrado.' });
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  const message = status >= 500 ? 'Error interno del servidor.' : error.message || 'Solicitud no válida.';
  res.status(status).json({ message });
}
