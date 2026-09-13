export function notFound(req, res) {
  res.status(404).json({ message: 'Recurso no encontrado.' });
}

export function errorHandler(error, req, res, next) {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(error.status || 500).json({ message: error.message || 'Error interno del servidor.' });
}
