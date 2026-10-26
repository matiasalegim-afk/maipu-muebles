import { passwordLogin, passwordMode, cookie, finishLogin, json, makeSession, readSession, sendCode, startLogin } from './_lib.js';
export async function onRequestGet({ request, env }) {
  const u = await readSession(request, env).catch(() => null);
  return json({ user: u ? { email: u.email, name: u.name } : null, mode: passwordMode(env) ? 'password' : 'code' });
}
// POST {email} → manda el código y devuelve {challenge}. POST {challenge, code} → crea la sesión de 30 días.
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json().catch(() => ({}));
    if (passwordMode(env)) {
      if (b.password == null) return json({ error: 'Escribí la contraseña.' }, 400);
      const u = await passwordLogin(env, b.password, request.headers.get('cf-connecting-ip'));
      return json({ user: { email: u.email, name: u.name } }, 200, { 'set-cookie': cookie(await makeSession(env, u), 2592000) });
    }
    // Fallback (sin ADMIN_PASSWORD_HASH): código por mail vía Brevo. Se puede borrar este bloque cuando la contraseña esté activa.
    if (b.challenge) {
      const u = await finishLogin(env, b.challenge, b.code);
      return json({ user: u }, 200, { 'set-cookie': cookie(await makeSession(env, u), 2592000) });
    }
    const { challenge, code, email } = await startLogin(env, b.email);
    await sendCode(env, email, code);
    return json({ challenge, email });
  } catch (e) { if (e.detail) console.log('mail error', e.detail); return json({ error: e.message }, e.status || 403); }
}
export const onRequestDelete = () => json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
