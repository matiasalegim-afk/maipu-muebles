// node --test tests/  — prueba login Google (firma real RSA), sesión y armado del commit único.
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyGoogle, makeSession, readSession, commitAll } from '../functions/api/_lib.js';
const env = { GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com', SESSION_SECRET: 'x'.repeat(32), GITHUB_TOKEN: 't' };
const b64u = (b) => Buffer.from(b).toString('base64url');
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' };
async function tok(p) {
  const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' })), b = b64u(JSON.stringify({ iss: 'https://accounts.google.com', aud: env.GOOGLE_CLIENT_ID, exp: Date.now() / 1000 + 600, email_verified: true, ...p }));
  return `${h}.${b}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${b}`)))}`;
}
const certs = async () => [jwk];
test('acepta a Sofía y a Matías', async () => {
  assert.equal((await verifyGoogle(await tok({ email: 'SofiaChahla17@gmail.com' }), env, Date.now(), certs)).email, 'sofiachahla17@gmail.com');
  assert.equal((await verifyGoogle(await tok({ email: 'matiasalegim@gmail.com' }), env, Date.now(), certs)).email, 'matiasalegim@gmail.com');
});
test('rechaza otros mails, otro cliente, vencido, firma falsa', async () => {
  await assert.rejects(verifyGoogle(await tok({ email: 'otro@gmail.com' }), env, Date.now(), certs), /permiso/);
  await assert.rejects(verifyGoogle(await tok({ email: 'matiasalegim@gmail.com', aud: 'x' }), env, Date.now(), certs), /cliente/);
  await assert.rejects(verifyGoogle(await tok({ email: 'matiasalegim@gmail.com', exp: 1 }), env, Date.now(), certs), /vencido/);
  const t = (await tok({ email: 'matiasalegim@gmail.com' })).split('.'); t[1] = b64u(JSON.stringify({ email: 'otro@gmail.com' }));
  await assert.rejects(verifyGoogle(t.join('.'), env, Date.now(), certs), /firma/);
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
