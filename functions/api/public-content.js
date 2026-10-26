import { publicContent, json } from './_lib.js';
export async function onRequestGet({ env }) {
  try { return json(await publicContent(env)); }
  catch (e) { return json({ error: e.message }, 502); }
}
