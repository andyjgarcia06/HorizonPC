import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

const withConversions = (row, exchangeRateCup) => {
  const rate = Number(exchangeRateCup);
  const incomeUsd = Number(row.incomeUsd || 0);
  const expenseUsd = Number(row.expenseUsd || 0);
  const incomeCup = Number(row.incomeCup || 0);
  const expenseCup = Number(row.expenseCup || 0);
  return {
    ...row,
    incomeCupToUsd: rate ? incomeCup / rate : 0,
    expenseCupToUsd: rate ? expenseCup / rate : 0,
    incomeUsdToCup: incomeUsd * rate,
    expenseUsdToCup: expenseUsd * rate
  };
};

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const account = await pool.query('SELECT exchange_rate_cup AS "exchangeRateCup" FROM users WHERE id=$1', [userId]);
    const exchangeRateCup = account.rows[0]?.exchangeRateCup || 0;
    const totals = await pool.query(`SELECT
      COALESCE(SUM(CASE WHEN type='Ingreso' THEN amount_usd ELSE 0 END),0) AS "incomeUsd",
      COALESCE(SUM(CASE WHEN type='Gasto' THEN amount_usd ELSE 0 END),0) AS "expenseUsd",
      COALESCE(SUM(CASE WHEN type='Ingreso' THEN amount_cup ELSE 0 END),0) AS "incomeCup",
      COALESCE(SUM(CASE WHEN type='Gasto' THEN amount_cup ELSE 0 END),0) AS "expenseCup",
      COUNT(*) AS "transactionCount"
      FROM transactions WHERE user_id=$1`, [userId]);
    const monthly = await pool.query(`SELECT TO_CHAR(DATE_TRUNC('month',transaction_date),'Mon YYYY') AS month,
      DATE_TRUNC('month', transaction_date) AS month_date,
      COALESCE(SUM(CASE WHEN type='Ingreso' THEN amount_usd ELSE 0 END),0) AS "incomeUsd",
      COALESCE(SUM(CASE WHEN type='Gasto' THEN amount_usd ELSE 0 END),0) AS "expenseUsd",
      COALESCE(SUM(CASE WHEN type='Ingreso' THEN amount_cup ELSE 0 END),0) AS "incomeCup",
      COALESCE(SUM(CASE WHEN type='Gasto' THEN amount_cup ELSE 0 END),0) AS "expenseCup"
      FROM transactions WHERE user_id=$1 AND transaction_date >= DATE_TRUNC('month',CURRENT_DATE)-INTERVAL '23 months'
      GROUP BY 1,2 ORDER BY month_date`, [userId]);
    const yearly = await pool.query(`SELECT EXTRACT(YEAR FROM transaction_date)::int AS year,
    COALESCE(SUM(CASE WHEN type='Ingreso' THEN amount_usd ELSE 0 END),0) AS "incomeUsd",
    COALESCE(SUM(CASE WHEN type='Gasto' THEN amount_usd ELSE 0 END),0) AS "expenseUsd",
    COALESCE(SUM(CASE WHEN type='Ingreso' THEN amount_cup ELSE 0 END),0) AS "incomeCup",
    COALESCE(SUM(CASE WHEN type='Gasto' THEN amount_cup ELSE 0 END),0) AS "expenseCup"
      FROM transactions WHERE user_id=$1 GROUP BY 1 ORDER BY 1`, [userId]);
    const recent = await pool.query(`SELECT t.id,t.type,t.description,t.amount_usd AS "amountUsd",t.amount_cup AS "amountCup",
      t.transaction_date AS "transactionDate" FROM transactions t WHERE user_id=$1 ORDER BY transaction_date DESC,id DESC LIMIT 6`, [userId]);
    const services = await pool.query('SELECT COUNT(*)::int AS count FROM services WHERE user_id=$1', [userId]);
    res.json({
      exchangeRateCup,
      totals: withConversions(totals.rows[0], exchangeRateCup),
      monthly: monthly.rows.map(row => withConversions(row, exchangeRateCup)),
      yearly: yearly.rows.map(row => withConversions(row, exchangeRateCup)),
      recent: recent.rows.map(row => ({
        ...row,
        amountCupToUsd: Number(exchangeRateCup) ? Number(row.amountCup || 0) / Number(exchangeRateCup) : 0,
        amountUsdToCup: Number(row.amountUsd || 0) * Number(exchangeRateCup)
      })),
      serviceCount: services.rows[0].count
    });
  } catch (error) { next(error); }
});

export default router;
