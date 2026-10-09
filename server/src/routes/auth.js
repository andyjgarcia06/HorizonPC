import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { body, validationResult } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';
import { clientOrigins, jwtSecret } from '../config.js';
import {
  createEmailVerificationToken,
  sendEmailVerification,
  verifyTurnstileToken
} from '../services/registration-verification.js';

const router = Router();
const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' }
});
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  next();
};
const tokenFor = (user) => jwt.sign({ id: user.id, email: user.email, name: user.name }, jwtSecret, { expiresIn: '7d' });

router.post('/register', authAttemptLimiter, [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('El nombre debe tener entre 2 y 120 caracteres.'),
  body('email').isEmail().normalizeEmail().isLength({ max: 180 }).withMessage('Ingresa un correo válido de hasta 180 caracteres.'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.'),
  body('company').optional().trim().isLength({ max: 180 }).withMessage('El nombre de empresa es muy largo.'),
  body('captchaToken').isString().isLength({ min: 1, max: 2048 }).withMessage('Completa la verificación anti-bots.')
], validate, async (req, res, next) => {
  try {
    const origin = req.get('origin');
    if (!origin || !clientOrigins.has(origin)) {
      return res.status(403).json({ message: 'El origen de este registro no está autorizado.' });
    }
    let captchaValid;
    try {
      captchaValid = await verifyTurnstileToken(req.body.captchaToken, new URL(origin).hostname);
    } catch {
      return res.status(503).json({ message: 'No se pudo validar el CAPTCHA. Inténtalo nuevamente.' });
    }
    if (!captchaValid) return res.status(400).json({ message: 'La verificación anti-bots falló o expiró. Inténtalo nuevamente.' });

    const { name, email, password, company } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const verification = createEmailVerificationToken();
    let user;
    try {
      const { rows } = await pool.query(
        `INSERT INTO users(name,email,password_hash,company,email_verified,email_verification_token_hash,email_verification_expires_at)
         VALUES($1,$2,$3,$4,FALSE,$5,$6) RETURNING id,email`,
        [name, email, passwordHash, company || 'HorizonPC', verification.tokenHash, verification.expiresAt]
      );
      user = rows[0];
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'Este correo ya está registrado.' });
      throw error;
    }

    try {
      await sendEmailVerification({
        email: user.email,
        name,
        token: verification.token,
        frontendOrigin: origin
      });
    } catch {
      try {
        await pool.query('DELETE FROM users WHERE id=$1 AND email_verified=FALSE', [user.id]);
      } catch (cleanupError) {
        return next(cleanupError);
      }
      return res.status(502).json({ message: 'No se pudo enviar el correo de verificación. No se creó la cuenta; inténtalo más tarde.' });
    }

    res.status(201).json({ message: 'Cuenta creada. Revisa tu correo y confirma el enlace para poder iniciar sesión.' });
  } catch (error) { next(error); }
});

router.post('/verify-email', [
  body('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('El enlace de verificación no es válido.')
], validate, async (req, res, next) => {
  try {
    const tokenHash = createHash('sha256').update(req.body.token).digest('hex');
    const { rows } = await pool.query(
      `UPDATE users
       SET email_verified=TRUE,email_verification_token_hash=NULL,email_verification_expires_at=NULL
       WHERE email_verification_token_hash=$1
         AND email_verification_expires_at > NOW()
         AND email_verified=FALSE
       RETURNING id`,
      [tokenHash]
    );
    if (!rows[0]) {
      return res.status(400).json({ message: 'El enlace venció o ya fue utilizado. Regístrate nuevamente o solicita otro enlace.' });
    }
    res.json({ message: 'Correo verificado. Ya puedes iniciar sesión.' });
  } catch (error) { next(error); }
});

router.post('/resend-verification', authAttemptLimiter, [
  body('email').isEmail().normalizeEmail().isLength({ max: 180 }).withMessage('Ingresa un correo válido.'),
  body('captchaToken').isString().isLength({ min: 1, max: 2048 }).withMessage('Completa la verificación anti-bots.')
], validate, async (req, res, next) => {
  try {
    const origin = req.get('origin');
    if (!origin || !clientOrigins.has(origin)) {
      return res.status(403).json({ message: 'El origen de esta solicitud no está autorizado.' });
    }
    let captchaValid;
    try {
      captchaValid = await verifyTurnstileToken(req.body.captchaToken, new URL(origin).hostname);
    } catch {
      return res.status(503).json({ message: 'No se pudo validar el CAPTCHA. Inténtalo nuevamente.' });
    }
    if (!captchaValid) return res.status(400).json({ message: 'La verificación anti-bots falló o expiró. Inténtalo nuevamente.' });

    const verification = createEmailVerificationToken();
    const { rows } = await pool.query(
      `UPDATE users
       SET email_verification_token_hash=$1,email_verification_expires_at=$2
       WHERE email=$3 AND email_verified=FALSE
       RETURNING id,name,email`,
      [verification.tokenHash, verification.expiresAt, req.body.email]
    );
    if (rows[0]) {
      try {
        await sendEmailVerification({
          email: rows[0].email,
          name: rows[0].name,
          token: verification.token,
          frontendOrigin: origin
        });
      } catch {
        try {
          await pool.query(
            `UPDATE users SET email_verification_token_hash=NULL,email_verification_expires_at=NULL
             WHERE id=$1 AND email_verification_token_hash=$2`,
            [rows[0].id, verification.tokenHash]
          );
        } catch (cleanupError) {
          return next(cleanupError);
        }
        return res.status(502).json({ message: 'No se pudo enviar el correo de verificación. Inténtalo más tarde.' });
      }
    }
    res.json({ message: 'Si existe una cuenta pendiente para ese correo, enviaremos un nuevo enlace de verificación.' });
  } catch (error) { next(error); }
});

router.post('/login', authAttemptLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Ingresa un correo válido.'),
  body('password').notEmpty().withMessage('Ingresa tu contraseña.')
], validate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,name,email,company,password_hash,email_verified FROM users WHERE email=$1', [req.body.email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
    if (!user.email_verified) return res.status(403).json({ message: 'Verifica tu correo electrónico desde el enlace enviado para poder iniciar sesión.' });
    delete user.password_hash;
    delete user.email_verified;
    res.json({ token: tokenFor(user), user });
  } catch (error) { next(error); }
});

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,name,email,company FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Usuario no encontrado.' });
    res.json({ user: rows[0] });
  } catch (error) { next(error); }
});

router.patch('/profile', authRequired, [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('El nombre debe tener entre 2 y 120 caracteres.'),
  body('email').isEmail().normalizeEmail().withMessage('Ingresa un correo válido.'),
  body('company').optional().trim().isLength({ max: 180 }).withMessage('El nombre de empresa es muy largo.'),
  body('currentPassword').notEmpty().withMessage('Ingresa tu contraseña actual para confirmar los cambios.')
], validate, async (req, res, next) => {
  try {
    const { rows: userRows } = await pool.query(
      'SELECT password_hash FROM users WHERE id=$1',
      [req.user.id]
    );
    const user = userRows[0];
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    if (!(await bcrypt.compare(req.body.currentPassword, user.password_hash))) {
      return res.status(401).json({ message: 'La contraseña actual no es correcta.' });
    }

    const { rows } = await pool.query(
      `UPDATE users SET name=$1,email=$2,company=$3 WHERE id=$4
       RETURNING id,name,email,company`,
      [req.body.name, req.body.email, req.body.company ?? '', req.user.id]
    );
    const updatedUser = rows[0];
    res.json({
      token: tokenFor(updatedUser),
      user: updatedUser,
      message: 'La información de la cuenta se actualizó correctamente.'
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ese correo electrónico ya está asociado a otra cuenta.' });
    }
    next(error);
  }
});

router.get('/exchange-rate', authRequired, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT exchange_rate_cup AS "exchangeRateCup" FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Usuario no encontrado.' });
    res.json({ exchangeRateCup: rows[0].exchangeRateCup });
  } catch (error) { next(error); }
});

router.patch('/exchange-rate', authRequired, [
  body('exchangeRateCup').isFloat({ min: 0.01 }).withMessage('La tasa debe ser mayor que cero.')
], validate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`UPDATE users SET exchange_rate_cup=$1 WHERE id=$2
      RETURNING exchange_rate_cup AS "exchangeRateCup"`, [Number(req.body.exchangeRateCup), req.user.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Usuario no encontrado.' });
    res.json({ exchangeRateCup: rows[0].exchangeRateCup, message: 'Tasa de cambio actualizada correctamente.' });
  } catch (error) { next(error); }
});

router.patch('/password', authRequired, [
  body('currentPassword').notEmpty().withMessage('Ingresa tu contraseña actual.'),
  body('newPassword').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres.')
], validate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(req.body.currentPassword, user.password_hash))) {
      return res.status(401).json({ message: 'La contraseña actual no es correcta.' });
    }
    if (req.body.currentPassword === req.body.newPassword) {
      return res.status(400).json({ message: 'La nueva contraseña debe ser diferente.' });
    }
    const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, req.user.id]);
    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (error) { next(error); }
});

export default router;
