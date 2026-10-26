// Panel Maipú: login con Google (ID token) + guardado en GitHub con UN commit por guardado.
// Variables en Cloudflare Pages: GOOGLE_CLIENT_ID, GITHUB_TOKEN (secreto), SESSION_SECRET (secreto),
// opcionales ADMIN_EMAILS (coma), REPO, BRANCH.
export const REPO = (env) => env.REPO || 'matiasalegim-afk/maipu-muebles';
export const BRANCH = (env) => env.BRANCH || 'main';
export const emails = (env) => (env.ADMIN_EMAILS || 'matiasalegim@gmail.com,sofiachahla17@gmail.com').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
export const json = (d, status = 200, h = {}) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...h } });
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

let certs = null, certsAt = 0;
export async function verifyGoogle(token, env, now = Date.now(), fetchCerts) {
  const [h, p, s] = String(token).split('.');
  if (!s) throw new Error('token inválido');
  const head = JSON.parse(new TextDecoder().decode(unb64u(h)));
  const pl = JSON.parse(new TextDecoder().decode(unb64u(p)));
  if (!fetchCerts && (!certs || now - certsAt > 3600e3)) { certs = (await (await fetch('https://www.googleapis.com/oauth2/v3/certs')).json()).keys; certsAt = now; }
  const keys = fetchCerts ? await fetchCerts() : certs;
  const jwk = keys.find((k) => k.kid === head.kid);
  if (!jwk || head.alg !== 'RS256') throw new Error('clave desconocida');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(`${h}.${p}`)))) throw new Error('firma inválida');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(pl.iss)) throw new Error('emisor inválido');
  if (pl.aud !== env.GOOGLE_CLIENT_ID) throw new Error('cliente inválido');
  if (pl.exp * 1000 < now) throw new Error('token vencido');
  if (!pl.email_verified) throw new Error('mail sin verificar');
  const email = String(pl.email).toLowerCase();
  if (!emails(env).includes(email)) throw new Error(`La cuenta ${email} no tiene permiso`);
  return { email, name: pl.name || email };
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
  if (u.exp < now || !emails(env).includes(u.email)) return null;
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
export async function commitAll(env, { files = {}, uploads = [], deletes = [], message, expectSha }, f = fetch) {
  const ref = await gh(env, `/git/ref/heads/${BRANCH(env)}`, {}, f);
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
