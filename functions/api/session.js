import { cookie, json, makeSession, readSession, verifyGoogle } from './_lib.js';
export async function onRequestGet({ request, env }) {
  const u = await readSession(request, env).catch(() => null);
  return json({ user: u ? { email: u.email, name: u.name } : null, clientId: env.GOOGLE_CLIENT_ID || null });
}
export async function onRequestPost({ request, env }) {
  try {
    const { credential } = await request.json();
    const u = await verifyGoogle(credential, env);
    return json({ user: u }, 200, { 'set-cookie': cookie(await makeSession(env, u), 2592000) });
  } catch (e) { return json({ error: e.message }, 403); }
}
export const onRequestDelete = () => json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
