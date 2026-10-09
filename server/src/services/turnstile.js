const turnstileSiteVerifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

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
