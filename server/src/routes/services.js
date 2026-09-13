import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};
const serviceRules = [
  body('name').trim().isLength({ min: 2, max: 160 }).withMessage('El nombre del servicio es obligatorio.'),
  body('category').optional().trim().isLength({ max: 80 }).withMessage('Categoría inválida.'),
  body('costUsd').optional().isFloat({ min: 0 }).withMessage('El costo USD debe ser positivo.'),
  body('costCup').optional().isFloat({ min: 0 }).withMessage('El costo CUP debe ser positivo.')
];

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT id,name,description,category,cost_usd AS "costUsd",cost_cup AS "costCup",status,created_at AS "createdAt"
      FROM services WHERE user_id=$1 ORDER BY created_at DESC`, [req.user.id]);
    res.json({ services: rows });
  } catch (error) { next(error); }
});

router.post('/', serviceRules, validate, async (req, res, next) => {
  try {
    const { name, description = '', category = 'Consultoría', costUsd = 0, costCup = 0, status = 'Activo' } = req.body;
    const { rows } = await pool.query(`INSERT INTO services(user_id,name,description,category,cost_usd,cost_cup,status)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,description,category,cost_usd AS "costUsd",cost_cup AS "costCup",status,created_at AS "createdAt"`,
      [req.user.id, name, description, category, Number(costUsd), Number(costCup), status === 'Inactivo' ? 'Inactivo' : 'Activo']);
    res.status(201).json({ service: rows[0] });
  } catch (error) { next(error); }
});

router.patch('/:id', serviceRules, validate, async (req, res, next) => {
  try {
    const { name, description = '', category = 'Consultoría', costUsd = 0, costCup = 0, status = 'Activo' } = req.body;
    const { rows } = await pool.query(`UPDATE services SET name=$1,description=$2,category=$3,cost_usd=$4,cost_cup=$5,status=$6
      WHERE id=$7 AND user_id=$8 RETURNING id,name,description,category,cost_usd AS "costUsd",cost_cup AS "costCup",status,created_at AS "createdAt"`,
      [name, description, category, Number(costUsd), Number(costCup), status === 'Inactivo' ? 'Inactivo' : 'Activo', req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Servicio no encontrado.' });
    res.json({ service: rows[0] });
  } catch (error) { next(error); }
});

export default router;
