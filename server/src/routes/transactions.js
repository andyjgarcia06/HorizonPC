import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { pool } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};
const rules = [
  body('description').trim().isLength({ min: 2, max: 200 }).withMessage('La descripción es obligatoria.'),
  body('type').isIn(['Ingreso', 'Gasto']).withMessage('Tipo de movimiento inválido.'),
  body('currency').optional().isIn(['USD', 'CUP']).withMessage('La moneda debe ser USD o CUP.'),
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('El monto debe ser mayor que cero.'),
  body('amountUsd').optional().isFloat({ min: 0 }).withMessage('El monto USD debe ser positivo.'),
  body('amountCup').optional().isFloat({ min: 0 }).withMessage('El monto CUP debe ser positivo.'),
  body('transactionDate').optional().isISO8601().withMessage('Fecha inválida.')
];

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT t.id,t.type,t.description,t.amount_usd AS "amountUsd",t.amount_cup AS "amountCup",
      t.transaction_date AS "transactionDate",t.notes,t.service_id AS "serviceId",s.name AS "serviceName"
      FROM transactions t LEFT JOIN services s ON s.id=t.service_id WHERE t.user_id=$1 ORDER BY t.transaction_date DESC,t.id DESC`, [req.user.id]);
    res.json({ transactions: rows });
  } catch (error) { next(error); }
});

router.post('/', rules, validate, async (req, res, next) => {
  try {
    const { type, description, currency, amount, amountUsd = 0, amountCup = 0, transactionDate, notes = '', serviceId = null } = req.body;
    // Se conservan los campos antiguos para no romper movimientos creados anteriormente.
    const normalizedUsd = currency ? (currency === 'USD' ? Number(amount) : 0) : Number(amountUsd);
    const normalizedCup = currency ? (currency === 'CUP' ? Number(amount) : 0) : Number(amountCup);
    if (!normalizedUsd && !normalizedCup) return res.status(400).json({ message: 'Ingresa un monto en USD o CUP.' });
    if (serviceId) {
      const service = await pool.query('SELECT id FROM services WHERE id=$1 AND user_id=$2', [serviceId, req.user.id]);
      if (!service.rowCount) return res.status(400).json({ message: 'El servicio seleccionado no es válido.' });
    }
    const { rows } = await pool.query(`INSERT INTO transactions(user_id,service_id,type,description,amount_usd,amount_cup,transaction_date,notes)
      VALUES($1,$2,$3,$4,$5,$6,COALESCE($7::date,CURRENT_DATE),$8)
      RETURNING id,type,description,amount_usd AS "amountUsd",amount_cup AS "amountCup",transaction_date AS "transactionDate",notes,service_id AS "serviceId"`,
      [req.user.id, serviceId || null, type, description, normalizedUsd, normalizedCup, transactionDate || null, notes]);
    res.status(201).json({ transaction: rows[0] });
  } catch (error) { next(error); }
});

router.patch('/:id', rules, validate, async (req, res, next) => {
  try {
    const { type, description, currency, amount, amountUsd = 0, amountCup = 0, transactionDate, notes = '', serviceId = null } = req.body;
    const normalizedUsd = currency ? (currency === 'USD' ? Number(amount) : 0) : Number(amountUsd);
    const normalizedCup = currency ? (currency === 'CUP' ? Number(amount) : 0) : Number(amountCup);
    if (!normalizedUsd && !normalizedCup) return res.status(400).json({ message: 'Ingresa un monto en USD o CUP.' });
    if (serviceId) {
      const service = await pool.query('SELECT id FROM services WHERE id=$1 AND user_id=$2', [serviceId, req.user.id]);
      if (!service.rowCount) return res.status(400).json({ message: 'El servicio seleccionado no es válido.' });
    }
    const { rows } = await pool.query(`UPDATE transactions SET service_id=$1,type=$2,description=$3,amount_usd=$4,amount_cup=$5,
      transaction_date=COALESCE($6::date,CURRENT_DATE),notes=$7 WHERE id=$8 AND user_id=$9
      RETURNING id,type,description,amount_usd AS "amountUsd",amount_cup AS "amountCup",transaction_date AS "transactionDate",notes,service_id AS "serviceId"`,
      [serviceId || null, type, description, normalizedUsd, normalizedCup, transactionDate || null, notes, req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Movimiento no encontrado.' });
    res.json({ transaction: rows[0] });
  } catch (error) { next(error); }
});

router.delete('/:id', param('id').isInt({ min: 1 }).withMessage('ID de movimiento inválido.'), validate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Movimiento no encontrado.' });
    res.json({ message: 'Movimiento eliminado correctamente.' });
  } catch (error) { next(error); }
});

export default router;
