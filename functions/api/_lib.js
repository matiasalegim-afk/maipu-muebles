// Panel Maipú: login con código por mail (6 dígitos) + guardado en GitHub con UN commit por guardado.
// Variables en Cloudflare Pages: BREVO_API_KEY (secreto; o RESEND_API_KEY), MAIL_FROM, GITHUB_TOKEN (secreto), SESSION_SECRET (secreto),
// opcionales MAIL_FROM_NAME, ADMIN_EMAILS (coma), REPO, BRANCH, binding KV LOGIN_KV.
export const REPO = (env) => env.REPO || 'matiasalegim-afk/maipu-muebles';
export const BRANCH = (env) => env.BRANCH || 'main';
export const emails = (env) => (env.ADMIN_EMAILS || 'matiasalegim@gmail.com,sofiachahla17@gmail.com').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
export const json = (d, status = 200, h = {}) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...h } });
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

// ---------- login con código por mail ----------
export const isAllowed = (env, email) => emails(env).includes(String(email || '').trim().toLowerCase());
const CODE_TTL = 10 * 60e3, MAX_TRIES = 5, RESEND_GAP = 60e3, MAX_SENDS_HOUR = 5;

/** Almacén chico con vencimiento: KV (binding LOGIN_KV) si existe; si no, Cache API de Cloudflare. */
export function store(env) {
  if (env.LOGIN_KV) return {
    get: async (k) => { const v = await env.LOGIN_KV.get(k); return v ? JSON.parse(v) : null; },
    put: (k, v, ttlS) => env.LOGIN_KV.put(k, JSON.stringify(v), { expirationTtl: Math.max(60, Math.ceil(ttlS)) }),
  };
  const url = (k) => `https://mm-login.internal/${encodeURIComponent(k)}`;
  return {
    get: async (k) => { const r = await caches.default.match(url(k)); return r ? r.json() : null; },
    put: (k, v, ttlS) => caches.default.put(url(k), new Response(JSON.stringify(v), { headers: { 'cache-control': `max-age=${Math.max(1, Math.ceil(ttlS))}` } })),
  };
}
const rnd = () => b64u(crypto.getRandomValues(new Uint8Array(12)));
export const newCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');

/** Paso 1: valida mail, limita envíos, genera código y devuelve {challenge, code}. El código se manda por mail, nunca al navegador. */
export async function startLogin(env, email, st = store(env), now = Date.now(), code = newCode()) {
  email = String(email || '').trim().toLowerCase();
  if (!isAllowed(env, email)) { const e = new Error('Ese mail no tiene permiso para entrar al panel.'); e.status = 403; throw e; }
  const rk = `rate:${email}`;
  const r = (await st.get(rk)) || { sends: [] };
  r.sends = r.sends.filter((t) => now - t < 3600e3);
  if (r.sends.length && now - r.sends.at(-1) < RESEND_GAP) { const e = new Error('Ya te mandamos un código. Esperá un minuto para pedir otro.'); e.status = 429; throw e; }
  if (r.sends.length >= MAX_SENDS_HOUR) { const e = new Error('Pediste muchos códigos. Probá de nuevo en una hora.'); e.status = 429; throw e; }
  r.sends.push(now); await st.put(rk, r, 3600);
  const n = rnd(), body = b64u(enc.encode(JSON.stringify({ email, n, exp: now + CODE_TTL })));
  const challenge = `${body}.${await hmac(env, `${body}.${code}`)}`;
  await st.put(`ch:${n}`, { tries: 0 }, CODE_TTL / 1e3);
  return { challenge, code, email };
}
/** Paso 2: verifica el código (máx 5 intentos, 10 min, un solo uso). */
export async function finishLogin(env, challenge, code, st = store(env), now = Date.now()) {
  const fail = (m, status = 403) => Object.assign(new Error(m), { status });
  const [body, sig] = String(challenge || '').split('.');
  if (!sig) throw fail('Pedí un código nuevo.');
  let c; try { c = JSON.parse(new TextDecoder().decode(unb64u(body))); } catch { throw fail('Pedí un código nuevo.'); }
  if (c.exp < now) throw fail('El código venció. Pedí uno nuevo.');
  const k = `ch:${c.n}`, s = await st.get(k);
  if (!s || s.used) throw fail('Ese código ya no sirve. Pedí uno nuevo.');
  if (s.tries >= MAX_TRIES) throw fail('Demasiados intentos. Pedí un código nuevo.', 429);
  const ttl = (c.exp - now) / 1e3;
  if (!/^\d{6}$/.test(String(code || '').trim()) || sig !== (await hmac(env, `${body}.${String(code).trim()}`))) {
    await st.put(k, { tries: s.tries + 1 }, ttl);
    throw fail(s.tries + 1 >= MAX_TRIES ? 'Demasiados intentos. Pedí un código nuevo.' : 'Código incorrecto. Revisalo y probá de nuevo.');
  }
  await st.put(k, { tries: s.tries, used: true }, ttl);
  if (!isAllowed(env, c.email)) throw fail('Ese mail no tiene permiso.');
  return { email: c.email, name: NAMES[c.email] || c.email };
}
const NAMES = { 'matiasalegim@gmail.com': 'Matías', 'sofiachahla17@gmail.com': 'Sofía' };

/** Envía el código. Brevo (BREVO_API_KEY) o Resend (RESEND_API_KEY). Remitente: MAIL_FROM. */
export async function sendCode(env, to, code, f = fetch) {
  const subject = `Tu código para el panel de Maipú: ${code}`;
  const text = `Tu código para entrar al panel de Maipú Muebles es: ${code}\n\nVence en 10 minutos. Si no lo pediste, ignorá este mail.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#29384F"><p>Tu código para entrar al panel de <b>Maipú Muebles</b>:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold">${code}</p><p style="color:#667">Vence en 10 minutos. Si no lo pediste, ignorá este mail.</p></div>`;
  const from = env.MAIL_FROM || 'matiasalegim@gmail.com', fromName = env.MAIL_FROM_NAME || 'Maipú Muebles';
  let r;
  if (env.BREVO_API_KEY) r = await f('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ sender: { email: from, name: fromName }, to: [{ email: to }], subject, textContent: text, htmlContent: html }) });
  else if (env.RESEND_API_KEY) r = await f('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: `${fromName} <${from}>`, to: [to], subject, text, html }) });
  else throw Object.assign(new Error('Falta configurar el envío de mails (BREVO_API_KEY).'), { status: 500 });
  if (!r.ok) throw Object.assign(new Error(`No se pudo mandar el mail (${r.status}). Probá de nuevo en un rato.`), { status: 502, detail: (await r.text()).slice(0, 300) });
}
async function hmac(env, data) {
  if (!env.SESSION_SECRET) throw new Error('Falta SESSION_SECRET');
  const k = await crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
export async function makeSession(env, user, now = Date.now()) {
  const body = b64u(enc.encode(JSON.stringify({ ...user, exp: now + 30 * 864e5 })));
  return `${body}.${await hmac(env, body)}`;
}
export async function readSession(req, env, now = Date.now()) {
  const m = (req.headers.get('cookie') || '').match(/(?:^|; )mm_s=([^;]+)/);
  if (!m) return null;
  const [body, sig] = m[1].split('.');
  if (!sig || sig !== (await hmac(env, body))) return null;
  const u = JSON.parse(new TextDecoder().decode(unb64u(body)));
  if (u.exp < now || (!u.pw && !emails(env).includes(u.email))) return null;
  return u;
}
export const cookie = (v, age) => `mm_s=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;

export function gh(env, path, init = {}, f = fetch) {
  return f(`https://api.github.com/repos/${REPO(env)}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'maipu-panel', 'content-type': 'application/json', ...(init.headers || {}) },
  }).then(async (r) => { if (!r.ok) throw new Error(`GitHub ${r.status} ${path}: ${(await r.text()).slice(0, 200)}`); return r.json(); });
}
export const CONTENT = ['productos', 'novedades', 'categorias', 'home', 'ajustes'];
const utf8b64 = (s) => { let o = ''; const b = enc.encode(s); for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(o); };

/** Un solo commit con JSONs + fotos nuevas + fotos borradas. */
export async function commitAll(env, opts, f = fetch) {
  // Reintenta si otro guardado (o un push de código) movió main entre leer y escribir; nunca pisa contenido ajeno
  for (let i = 0; ; i++) {
    try { return await commitOnce(env, opts, f); }
    catch (e) { if (i < 2 && /GitHub 422 \/git\/refs/.test(e.message)) continue; throw e; }
  }
}
async function commitOnce(env, { files = {}, uploads = [], deletes = [], message, expectSha }, f = fetch) {
  const ref = await gh(env, `/git/ref/heads/${BRANCH(env)}`, { cache: 'no-store' }, f);
  const head = ref.object.sha;
  if (expectSha && expectSha !== head && Object.keys(files).length) {
    const cmp = await gh(env, `/compare/${expectSha}...${head}`, {}, f);
    const tocados = (cmp.files || []).map((x) => x.filename).filter((n) => Object.keys(files).some((k) => n === `content/${k}.json`));
    if (tocados.length) { const e = new Error('Alguien guardó cambios mientras editabas. Recargá el panel y volvé a hacer el cambio.'); e.status = 409; throw e; }
  }
  const base = await gh(env, `/git/commits/${head}`, {}, f);
  const tree = [];
  for (const [name, data] of Object.entries(files)) {
    if (!CONTENT.includes(name)) throw new Error(`archivo no permitido: ${name}`);
    const blob = await gh(env, '/git/blobs', { method: 'POST', body: JSON.stringify({ content: utf8b64(JSON.stringify(data, null, 2) + '\n'), encoding: 'base64' }) }, f);
    tree.push({ path: `content/${name}.json`, mode: '100644', type: 'blob', sha: blob.sha });
  }
  for (const u of uploads) {
    if (!/^img\/uploads\/[a-z0-9][a-z0-9._-]{0,90}\.(webp|jpe?g|png)$/.test(u.path)) throw new Error(`ruta de foto inválida: ${u.path}`);
    if (u.base64.length > 8e6) throw new Error('foto demasiado grande');
    const blob = await gh(env, '/git/blobs', { method: 'POST', body: JSON.stringify({ content: u.base64, encoding: 'base64' }) }, f);
    tree.push({ path: u.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  for (const d of deletes) if (/^img\/uploads\/[^/]+$/.test(d)) tree.push({ path: d, mode: '100644', type: 'blob', sha: null });
  if (!tree.length) return { sha: head, unchanged: true };
  const t = await gh(env, '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree }) }, f);
  const c = await gh(env, '/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: t.sha, parents: [head] }) }, f);
  await gh(env, `/git/refs/heads/${BRANCH(env)}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha, force: false }) }, f);
  return { sha: c.sha };
}

// Contenido público siempre fresco: sha actual de main (API, sin caché) + archivos en ese sha (URL inmutable)
export async function publicContent(env, f = fetch) {
  const ref = await gh(env, `/git/ref/heads/${BRANCH(env)}`, { cache: 'no-store' }, f);
  const sha = ref.object.sha, out = { sha };
  await Promise.all(CONTENT.map(async (n) => {
    const r = await f(`https://raw.githubusercontent.com/${REPO(env)}/${sha}/content/${n}.json`);
    if (!r.ok) throw new Error(`raw ${r.status} ${n}`);
    out[n] = await r.json();
  }));
  return out;
}

// ---------- login con contraseña (ADMIN_PASSWORD_HASH = "pbkdf2$<iter>$<salt b64u>$<hash b64u>") ----------
// Si ADMIN_PASSWORD_HASH no existe, el panel sigue con el login por código al mail (fallback).
export const passwordMode = (env) => /^pbkdf2\$\d+\$[\w-]+\$[\w-]+$/.test(env.ADMIN_PASSWORD_HASH || '');
export async function pbkdf2(pw, salt, iter) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, 256));
}
const eq = (a, b) => { let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a[i] | 0) ^ (b[i] | 0); return d === 0; };
const PW_MAX = 5, PW_WIN = 15 * 60;
export async function passwordLogin(env, pw, ip, st = store(env), now = Date.now()) {
  const k = 'pw:' + (ip || 'x'); const r = (await st.get(k)) || { n: 0, t: now };
  if (now - r.t > PW_WIN * 1e3) { r.n = 0; r.t = now; }
  if (r.n >= PW_MAX) throw Object.assign(new Error('Demasiados intentos. Esperá 15 minutos y probá de nuevo.'), { status: 429 });
  const [, iter, salt, hash] = env.ADMIN_PASSWORD_HASH.split('$');
  const ok = eq(await pbkdf2(String(pw || ''), unb64u(salt), +iter), unb64u(hash));
  if (!ok) { r.n++; await st.put(k, r, PW_WIN); throw Object.assign(new Error(r.n >= PW_MAX ? 'Demasiados intentos. Esperá 15 minutos y probá de nuevo.' : 'Contraseña incorrecta.'), { status: r.n >= PW_MAX ? 429 : 403 }); }
  await st.put(k, { n: 0, t: now }, 60);
  return { email: 'panel@maipumuebles', name: 'Maipú', pw: 1 };
}
