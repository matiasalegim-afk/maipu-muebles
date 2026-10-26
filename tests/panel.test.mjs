// node --test tests/  — prueba login por código de mail (límites, vencimiento, un solo uso), sesión y armado del commit único.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startLogin, finishLogin, sendCode, makeSession, readSession, commitAll } from '../functions/api/_lib.js';
const env = { SESSION_SECRET: 'x'.repeat(32), GITHUB_TOKEN: 't' };
const mem = () => { const m = new Map(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, structuredClone(v)); } }; };
test('código por mail: Sofía y Matías entran, otros no', async () => {
  for (const mail of ['SofiaChahla17@gmail.com ', 'matiasalegim@gmail.com']) {
    const st = mem(); const { challenge, code } = await startLogin(env, mail, st);
    assert.match(code, /^\d{6}$/); assert.ok(!challenge.includes(code));
    assert.equal((await finishLogin(env, challenge, code, st)).email, mail.trim().toLowerCase());
  }
  await assert.rejects(startLogin(env, 'otro@gmail.com', mem()), (e) => e.status === 403);
});
test('código incorrecto, 5 intentos, vencido, un solo uso, challenge falso', async () => {
  const st = mem(), t0 = Date.now(); const { challenge, code } = await startLogin(env, 'sofiachahla17@gmail.com', st, t0, '123456');
  for (let i = 0; i < 5; i++) await assert.rejects(finishLogin(env, challenge, '000000', st, t0), /incorrecto|intentos/);
  await assert.rejects(finishLogin(env, challenge, code, st, t0), /intentos/);
  const st2 = mem(); const c2 = await startLogin(env, 'sofiachahla17@gmail.com', st2, t0, '654321');
  await assert.rejects(finishLogin(env, c2.challenge, '654321', st2, t0 + 11 * 60e3), /venció/);
  assert.ok(await finishLogin(env, c2.challenge, '654321', st2, t0));
  await assert.rejects(finishLogin(env, c2.challenge, '654321', st2, t0), /ya no sirve/);
  const st3 = mem(); const c3 = await startLogin(env, 'sofiachahla17@gmail.com', st3, t0, '111111');
  const [b, sig] = c3.challenge.split('.'); const fake = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(b, 'base64url')), email: 'otro@gmail.com' })).toString('base64url');
  await assert.rejects(finishLogin(env, `${fake}.${sig}`, '111111', st3, t0));
});
test('límite de envíos: 1 por minuto, 5 por hora', async () => {
  const st = mem(), t = Date.now(), m = 'matiasalegim@gmail.com';
  await startLogin(env, m, st, t);
  await assert.rejects(startLogin(env, m, st, t + 30e3), (e) => e.status === 429);
  for (let i = 1; i < 5; i++) await startLogin(env, m, st, t + i * 61e3);
  await assert.rejects(startLogin(env, m, st, t + 6 * 61e3), /muchos/);
  await startLogin(env, m, st, t + 3601e3 + 5 * 61e3);
});
test('envío por Brevo y por Resend', async () => {
  const calls = []; const f = async (u, i) => { calls.push([u, i]); return new Response('{}', { status: 201 }); };
  await sendCode({ BREVO_API_KEY: 'k', MAIL_FROM: 'a@b.com' }, 'sofiachahla17@gmail.com', '123456', f);
  assert.match(calls[0][0], /brevo/); assert.equal(calls[0][1].headers['api-key'], 'k'); assert.match(calls[0][1].body, /123456/);
  await sendCode({ RESEND_API_KEY: 'r' }, 'x@y.com', '123456', f); assert.match(calls[1][0], /resend/);
  await assert.rejects(sendCode({}, 'x@y.com', '1', f), /BREVO_API_KEY/);
  await assert.rejects(sendCode({ BREVO_API_KEY: 'k' }, 'x@y.com', '1', async () => new Response('no', { status: 401 })), /No se pudo/);
});
test('sesión firmada', async () => {
  const s = await makeSession(env, { email: 'sofiachahla17@gmail.com', name: 'Sofía' });
  const req = (c) => new Request('https://x/', { headers: { cookie: `mm_s=${c}` } });
  assert.equal((await readSession(req(s), env)).email, 'sofiachahla17@gmail.com');
  assert.equal(await readSession(req(s.slice(0, -2) + 'aa'), env), null);
  assert.equal(await readSession(req(s), { ...env, ADMIN_EMAILS: 'otro@x.com' }), null);
});
test('un solo commit con json + foto + borrado; rechaza rutas raras', async () => {
  const calls = [];
  const f = async (url, init = {}) => { calls.push([init.method || 'GET', url.replace(/.*maipu-muebles/, ''), init.body && JSON.parse(init.body)]);
    const u = url; const r = u.includes('/git/ref/') ? { object: { sha: 'H' } } : u.includes('/git/commits/H') ? { tree: { sha: 'T0' } } : { sha: 'S' + calls.length };
    return new Response(JSON.stringify(r)); };
  const out = await commitAll(env, { files: { productos: { items: [{ nombre: 'Ñandú' }] } }, uploads: [{ path: 'img/uploads/a-1.webp', base64: 'AAAA' }], deletes: ['img/uploads/vieja.jpg'], message: 'm' }, f);
  const tree = calls.find((c) => c[1] === '/git/trees')[2].tree;
  assert.deepEqual(tree.map((t) => t.path), ['content/productos.json', 'img/uploads/a-1.webp', 'img/uploads/vieja.jpg']);
  assert.equal(tree[2].sha, null);
  assert.equal(calls.filter((c) => c[1] === '/git/commits').length, 1);
  assert.equal(calls.at(-1)[0], 'PATCH'); assert.ok(out.sha);
  await assert.rejects(commitAll(env, { uploads: [{ path: '../index.html', base64: 'A' }] }, f), /inválida/);
  await assert.rejects(commitAll(env, { files: { 'x/../app': {} } }, f), /no permitido/);
});
test('conflicto si otro guardó el mismo archivo', async () => {
  const f = async (url) => new Response(JSON.stringify(url.includes('/git/ref/') ? { object: { sha: 'NEW' } } : url.includes('/compare/') ? { files: [{ filename: 'content/productos.json' }] } : {}));
  await assert.rejects(commitAll(env, { files: { productos: { items: [] } }, expectSha: 'OLD' }, f), (e) => e.status === 409);
});
import { publicContent } from '../functions/api/_lib.js';
test('contenido público: lee el sha actual de main y los archivos en ese sha', async () => {
  const urls = [];
  const f = async (u, init) => { urls.push(u); if (u.includes('/git/ref/')) { assert.equal(init.cache, 'no-store'); return new Response(JSON.stringify({ object: { sha: 'abc123' } })); } return new Response(JSON.stringify({ n: u.split('/').pop() })); };
  const d = await publicContent({ GITHUB_TOKEN: 't' }, f);
  assert.equal(d.sha, 'abc123'); assert.equal(d.productos.n, 'productos.json');
  assert.ok(urls.filter((u) => u.includes('raw.githubusercontent')).every((u) => u.includes('/abc123/content/')));
});
test('si main se movió justo al guardar (422 no fast-forward), reintenta sobre el head nuevo', async () => {
  let heads = ['H1', 'H2'], patches = 0, parents = [];
  const f = async (url, init = {}) => {
    if (url.includes('/git/ref/')) return new Response(JSON.stringify({ object: { sha: heads.length > 1 ? heads.shift() : heads[0] } }));
    if (url.includes('/compare/')) return new Response(JSON.stringify({ files: [{ filename: 'app.js' }] }));
    if (url.includes('/git/refs/')) { patches++; return patches === 1 ? new Response('Update is not a fast forward', { status: 422 }) : new Response('{}'); }
    if (init.method === 'POST' && url.endsWith('/git/commits')) parents.push(JSON.parse(init.body).parents[0]);
    return new Response(JSON.stringify({ sha: 'X', tree: { sha: 'T' } }));
  };
  await commitAll(env, { files: { productos: { items: [] } }, expectSha: 'H1', message: 'm' }, f);
  assert.equal(patches, 2); assert.deepEqual(parents, ['H1', 'H2']);
});
test('la web pide las fotos subidas al commit actual, no a main (cache de 5 min)', async () => {
  const fs = await import('node:fs');
  const s = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(s, /if\(d\.sha\)SHA=d\.sha/); assert.match(s, /RAW\.replace\(\/main\\\/\$\/,SHA\+'\/'\)/);
});

import { passwordLogin, passwordMode, pbkdf2 } from '../functions/api/_lib.js';
test('login con contraseña: hash, rate limit, sesión', async () => {
  const b = (u) => Buffer.from(u).toString('base64url');
  const salt = new Uint8Array(16).fill(7); const h = await pbkdf2('prueba-123', salt, 1000);
  const env = { ADMIN_PASSWORD_HASH: `pbkdf2$1000$${b(salt)}$${b(h)}`, SESSION_SECRET: 'x' };
  assert.ok(passwordMode(env)); assert.ok(!passwordMode({}));
  const m = new Map(); const st = { get: async (k) => m.get(k) || null, put: async (k, v) => m.set(k, structuredClone(v)) };
  const u = await passwordLogin(env, 'prueba-123', '1.1.1.1', st); assert.equal(u.pw, 1);
  for (let i = 0; i < 4; i++) await assert.rejects(passwordLogin(env, 'mal', '2.2.2.2', st), /incorrecta/);
  await assert.rejects(passwordLogin(env, 'mal', '2.2.2.2', st), /Demasiados/);
  await assert.rejects(passwordLogin(env, 'prueba-123', '2.2.2.2', st), /Demasiados/);
  const s = await makeSession(env, u); const req = new Request('https://x/', { headers: { cookie: 'mm_s=' + s } });
  assert.equal((await readSession(req, env)).pw, 1);
});
