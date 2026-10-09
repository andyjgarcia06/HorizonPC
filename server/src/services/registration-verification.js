import { createHash, randomBytes } from 'node:crypto';

const turnstileSiteVerifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const resendEmailsUrl = 'https://api.resend.com/emails';
const verificationTokenLifetimeMs = 24 * 60 * 60 * 1000;

export function createEmailVerificationToken() {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + verificationTokenLifetimeMs)
  };
}

export async function verifyTurnstileToken(token, expectedHostname) {
  const response = await fetch(turnstileSiteVerifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token
    }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error('El servicio de verificación anti-bots no está disponible.');
  const result = await response.json();
  return result.success === true && result.hostname === expectedHostname;
}

export async function sendEmailVerification({ email, name, token, frontendOrigin }) {
  const verificationUrl = new URL('/', frontendOrigin);
  verificationUrl.searchParams.set('verify-email', token);
  const escapedName = name.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  const response = await fetch(resendEmailsUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: 'Confirma tu correo electrónico',
      html: `<p>Hola ${escapedName}:</p><p>Confirma tu correo electrónico para activar tu cuenta de Horizon Finanzas.</p><p><a href="${verificationUrl.toString()}">Verificar mi correo</a></p><p>Este enlace vence en 24 horas. Si no solicitaste esta cuenta, ignora este mensaje.</p>`,
      text: `Hola ${name}:\n\nConfirma tu correo electrónico para activar tu cuenta de Horizon Finanzas:\n${verificationUrl.toString()}\n\nEste enlace vence en 24 horas. Si no solicitaste esta cuenta, ignora este mensaje.`
    }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error('El proveedor de correo no pudo enviar el mensaje de verificación.');
}
