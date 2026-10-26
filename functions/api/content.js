import { CONTENT, commitAll, gh, json, readSession, BRANCH } from './_lib.js';
export async function onRequestGet({ request, env }) {
  const u = await readSession(request, env).catch(() => null);
  if (!u) return json({ error: 'Sesión vencida' }, 401);
  try {
    const ref = await gh(env, `/git/ref/heads/${BRANCH(env)}`);
    const sha = ref.object.sha;
    const out = { sha };
    await Promise.all(CONTENT.map(async (n) => {
      const r = await gh(env, `/contents/content/${n}.json?ref=${sha}`, { headers: { accept: 'application/vnd.github.raw+json' } }).catch(async () => null);
      out[n] = r;
    }));
    return json(out);
  } catch (e) { return json({ error: e.message }, 502); }
}
export async function onRequestPost({ request, env }) {
  const u = await readSession(request, env).catch(() => null);
  if (!u) return json({ error: 'Sesión vencida, volvé a entrar' }, 401);
  try {
    const b = await request.json();
    const r = await commitAll(env, { files: b.files, uploads: b.uploads, deletes: b.deletes, expectSha: b.sha, message: `Panel: ${String(b.summary || 'cambios').slice(0, 80)} (${u.email})` });
    return json({ ok: true, ...r });
  } catch (e) { return json({ error: e.message }, e.status || 502); }
}
