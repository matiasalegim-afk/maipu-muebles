// Panel Maipú Muebles: login con Google, edición y UN commit por "Guardar y publicar".
const RAW = 'https://raw.githubusercontent.com/matiasalegim-afk/maipu-muebles/';
const CATS_FALLBACK = [['dormitorio', 'Dormitorio'], ['guardado', 'Guardado'], ['escritorios', 'Escritorios y oficina'], ['cocina', 'Cocina'], ['living', 'Living']];
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ars = (v) => { if (v == null || v === '') return ''; const n = Number(String(v).replace(/[^\d,]/g, '').replace(',', '.')); return n > 0 ? '$ ' + Math.round(n).toLocaleString('es-AR') : String(v); };
const app = $('#app');
let D = null, ORIG = '', sha = '', view = { tab: 'productos', idx: null, q: '', cat: '' };
const pend = new Map(); // ruta -> {base64, url}
const quitadas = new Set();

function toast(m, bad) { const t = $('#toast'); t.textContent = m; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(t._t); t._t = setTimeout(() => (t.className = 'toast'), bad ? 6000 : 2800); }
const api = async (path, opt = {}) => { const r = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opt }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || `Error ${r.status}`), { status: r.status }); return j; };
const src = (p) => { if (!p) return ''; if (pend.has(p.replace(/^\//, ''))) return pend.get(p.replace(/^\//, '')).url; return /^\/?img\/uploads\//.test(p) ? RAW + sha + '/' + p.replace(/^\//, '') : '/' + p.replace(/^\//, ''); };
const dirty = () => JSON.stringify(D) !== ORIG;
function sync() { $('#bar').hidden = !dirty(); }
window.addEventListener('beforeunload', (e) => { if (D && dirty()) { e.preventDefault(); e.returnValue = ''; } });

// ---------- login ----------
async function start() {
  let s;
  try { s = await api('/api/session'); } catch { app.innerHTML = '<div class="center"><p>No se pudo conectar. Recargá la página.</p></div>'; return; }
  if (s.user) return load(s.user);
  app.innerHTML = `<div class="center"><div class="login"><img src="/logo.svg" alt="Maipú Muebles"><h1>Hola 👋</h1><p class="sub">Entrá con tu cuenta de Google para cargar productos, precios y fotos.</p><div id="gbtn"></div><small class="sub" id="lerr"></small></div></div>`;
  if (!s.clientId) { $('#lerr').textContent = 'Falta configurar GOOGLE_CLIENT_ID.'; return; }
  const go = () => {
    google.accounts.id.initialize({ client_id: s.clientId, ux_mode: 'popup', callback: async ({ credential }) => {
      try { const r = await api('/api/session', { method: 'POST', body: JSON.stringify({ credential }) }); load(r.user); }
      catch (e) { $('#lerr').textContent = e.message; }
    } });
    google.accounts.id.renderButton($('#gbtn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es' });
  };
  window.google?.accounts ? go() : window.addEventListener('load', go);
}
async function load(user) {
  $('#who').innerHTML = `<span>${esc(user.name)}</span><button id="out">Salir</button>`;
  $('#out').onclick = async () => { if (dirty() && !confirm('Tenés cambios sin guardar. ¿Salir igual?')) return; await api('/api/session', { method: 'DELETE' }); location.reload(); };
  app.innerHTML = '<div class="center"><div class="spin"></div></div>';
  try { const r = await api('/api/content'); sha = r.sha; delete r.sha; D = r; ORIG = JSON.stringify(D); pend.clear(); quitadas.clear(); render(); }
  catch (e) { if (e.status === 401) return start(); app.innerHTML = `<div class="center"><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`; }
}

// ---------- vistas ----------
const TABS = [['productos', 'Productos'], ['novedades', 'Novedades y ofertas'], ['categorias', 'Categorías'], ['ajustes', 'Local y horarios'], ['home', 'Textos de la web']];
const cats = () => (D.categorias?.items?.length ? D.categorias.items.map((c) => [c.id, c.nombre]) : CATS_FALLBACK);
function render() {
  sync();
  const t = view.tab;
  let h = `<nav class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === t}">${l}</button>`).join('')}</nav>`;
  if (view.idx !== null) h += editor();
  else if (t === 'productos') h += listaProductos();
  else if (t === 'novedades') h += listaSimple('novedades', 'Novedades y ofertas', (n) => [n.titulo, n.etiqueta, n.foto, n.publicado !== false], 'Nueva novedad');
  else if (t === 'categorias') h += listaSimple('categorias', 'Categorías', (c) => [c.nombre, c.id, c.foto, true], 'Nueva categoría');
  else if (t === 'ajustes') h += formAjustes();
  else h += formHome();
  app.innerHTML = h;
  window.scrollTo({ top: view.idx !== null ? 0 : window.scrollY });
}
function listaProductos() {
  const items = D.productos.items;
  const q = view.q.toLowerCase();
  const vis = items.map((p, i) => [p, i]).filter(([p]) => (!q || p.nombre.toLowerCase().includes(q)) && (!view.cat || p.categoria === view.cat));
  const lab = Object.fromEntries(cats());
  return `<h1>Productos</h1><p class="sub">${items.length} productos · ${items.filter((p) => p.publicado !== false).length} visibles en la web</p>
  <div class="tools"><input id="q" type="search" placeholder="Buscar producto…" value="${esc(view.q)}"><select id="fcat"><option value="">Todas las categorías</option>${cats().map(([v, l]) => `<option value="${v}" ${v === view.cat ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><button class="btn" data-new="productos">+ Nuevo producto</button></div>
  <div class="list">${vis.map(([p, i]) => `<button class="row" data-edit="${i}"><div class="ph">${p.fotos?.[0] ? `<img loading="lazy" src="${esc(src(foto(p.fotos[0])))}" alt="">` : ''}</div><div><b>${esc(p.nombre || 'Sin nombre')}</b><small>${esc(lab[p.categoria] || p.categoria || '')}</small><div>${p.publicado === false ? '<span class="pill off">Oculto</span>' : ''}${p.destacado ? '<span class="pill star">★ Destacado</span>' : ''}${p.precio_anterior ? '<span class="pill">Oferta</span>' : ''}</div></div><span class="price">${esc(ars(p.precio) || 'Consultar')}</span></button>`).join('') || '<div class="empty">No hay productos con ese filtro.</div>'}</div>`;
}
function listaSimple(k, titulo, f, nuevo) {
  return `<h1>${titulo}</h1><p class="sub">Tocá uno para editarlo.</p><div class="tools"><button class="btn" data-new="${k}">+ ${nuevo}</button></div>
  <div class="list">${D[k].items.map((it, i) => { const [a, b, ph, on] = f(it); return `<button class="row" data-edit="${i}"><div class="ph">${ph ? `<img loading="lazy" src="${esc(src(ph))}" alt="">` : ''}</div><div><b>${esc(a || 'Sin título')}</b><small>${esc(b || '')}</small>${on ? '' : '<div><span class="pill off">Oculto</span></div>'}</div><span></span></button>`; }).join('') || '<div class="empty">Todavía no hay nada cargado.</div>'}</div>`;
}
const foto = (f) => (typeof f === 'string' ? f : f?.foto || '');
const inp = (k, l, v, o = {}) => `<label class="f"><span>${l}</span>${o.area ? `<textarea data-k="${k}">${esc(v)}</textarea>` : `<input data-k="${k}" value="${esc(v)}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.num ? 'inputmode="numeric"' : ''}>`}${o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
const sw = (k, l, v, hint) => `<label class="sw"><span><b>${l}</b>${hint ? `<br><small class="sub">${hint}</small>` : ''}</span><input type="checkbox" data-k="${k}" ${v ? 'checked' : ''}></label>`;
const fotosUI = (k, arr, max) => `<div class="f"><span>${max === 1 ? 'Foto' : 'Fotos'}</span>${max === 1 ? '' : '<small>La primera es la portada. Usá las flechas para ordenar.</small>'}<div class="photos">${arr.map((f, i) => `<div class="photo"><img src="${esc(src(f))}" alt="">${i === 0 && max !== 1 ? '<span class="first">Portada</span>' : ''}<div class="ctl">${max === 1 ? '<span></span>' : `<button data-mv="${k}|${i}|-1" aria-label="Mover antes" ${i ? '' : 'disabled'}>←</button>`}<button data-rm="${k}|${i}" aria-label="Quitar foto">🗑</button>${max === 1 ? '' : `<button data-mv="${k}|${i}|1" aria-label="Mover después" ${i < arr.length - 1 ? '' : 'disabled'}>→</button>`}</div></div>`).join('')}${arr.length < (max || 30) ? `<label class="add"><input type="file" accept="image/*" ${max === 1 ? '' : 'multiple'} hidden data-up="${k}"><span>＋<br>Agregar foto</span></label>` : ''}</div></div>`;
function editor() {
  const k = view.tab, it = D[k].items[view.idx];
  const head = `<a href="#" class="back" data-back>← Volver a la lista</a>`;
  const foot = `<div class="sticky"><button class="btn danger" data-del>Eliminar</button><button class="btn" data-back>Listo</button></div>`;
  if (k === 'productos') return `${head}<div class="card"><h2>${esc(it.nombre || 'Nuevo producto')}</h2>
    ${inp('nombre', 'Nombre', it.nombre)}
    <label class="f"><span>Categoría</span><select data-k="categoria">${cats().map(([v, l]) => `<option value="${v}" ${v === it.categoria ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
    ${fotosUI('fotos', (it.fotos || []).map(foto))}
    <div class="grid2">${inp('precio', 'Precio', it.precio, { num: 1, ph: 'Ej: 250000', hint: 'Si lo dejás vacío, la web muestra “Consultar precio”.' })}${inp('precio_anterior', 'Precio anterior (oferta)', it.precio_anterior, { num: 1, hint: 'Opcional. Se muestra tachado.' })}</div>
    <div class="grid2">${inp('medidas', 'Medidas', it.medidas)}${inp('material', 'Material', it.material)}</div>
    ${inp('descripcion', 'Descripción corta', it.descripcion, { area: 1 })}
    ${sw('publicado', 'Visible en la web', it.publicado !== false, 'Apagalo para ocultarlo sin borrarlo.')}
    ${sw('destacado', 'Destacado', !!it.destacado, 'Aparece primero.')}
    ${foot}</div>`;
  if (k === 'novedades') return `${head}<div class="card"><h2>${esc(it.titulo || 'Nueva novedad')}</h2>${inp('titulo', 'Título', it.titulo)}
    <label class="f"><span>Tipo</span><select data-k="etiqueta">${['Novedad', 'Oferta'].map((v) => `<option ${v === it.etiqueta ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    ${inp('texto', 'Texto', it.texto, { area: 1 })}${fotosUI('foto', it.foto ? [it.foto] : [], 1)}${sw('publicado', 'Visible en la web', it.publicado !== false)}${foot}</div>`;
  return `${head}<div class="card"><h2>${esc(it.nombre || 'Nueva categoría')}</h2>${inp('nombre', 'Nombre visible', it.nombre)}${inp('id', 'Código', it.id, { hint: 'Sin espacios. No lo cambies si ya tiene productos.' })}${fotosUI('foto', it.foto ? [it.foto] : [], 1)}${foot}</div>`;
}
function formAjustes() {
  const a = D.ajustes;
  return `<h1>Local y horarios</h1><p class="sub">WhatsApp, horarios y condiciones que se ven en la web.</p><div class="card" data-form="ajustes">
  <div class="grid2">${inp('whatsapp', 'WhatsApp (549381…)', a.whatsapp, { num: 1 })}${inp('telefono_visible', 'Teléfono como se muestra', a.telefono_visible)}</div>
  <div class="f"><span>Horarios</span>${(a.horarios || []).map((h, i) => `<div class="hrow"><label class="f"><input data-h="${i}|dias" value="${esc(h.dias)}" placeholder="Días"></label><label class="f"><input data-h="${i}|horas" value="${esc(h.horas)}" placeholder="Horario"></label><button class="icon" data-hrm="${i}" aria-label="Quitar">✕</button></div>`).join('')}<div><button class="btn ghost" data-hadd>+ Agregar horario</button></div></div>
  ${inp('cuotas', 'Cuotas', a.cuotas, { area: 1 })}${inp('envio', 'Envío', a.envio, { area: 1 })}${inp('posventa', 'Posventa', a.posventa, { area: 1 })}</div>`;
}
function formHome() {
  const h = D.home;
  return `<h1>Textos de la web</h1><p class="sub">Portada y sección Nosotros.</p><div class="card" data-form="home">
  ${inp('hero_eyebrow', 'Línea chica de arriba', h.hero_eyebrow)}${inp('hero_titulo', 'Titular', h.hero_titulo, { hint: 'Separá renglones con | y poné *entre asteriscos* el renglón en cursiva.' })}
  ${inp('hero_texto', 'Texto de portada', h.hero_texto, { area: 1 })}${inp('nosotros_titulo', 'Título Nosotros', h.nosotros_titulo)}${inp('nosotros_texto', 'Texto Nosotros', h.nosotros_texto, { area: 1 })}</div>`;
}

// ---------- eventos ----------
const target = () => (view.idx !== null ? D[view.tab].items[view.idx] : D[view.tab]);
app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'q') { view.q = el.value; const pos = el.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (el.dataset.h) { const [i, f] = el.dataset.h.split('|'); D.ajustes.horarios[i][f] = el.value; return sync(); }
  if (el.dataset.k) { const o = target(); o[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; sync(); }
});
app.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 'fcat') { view.cat = el.value; return render(); }
  if (el.dataset.up) {
    const k = el.dataset.up, o = target();
    for (const file of el.files) {
      try {
        toast('Preparando foto…');
        const { base64, ext, url } = await achicar(file);
        const ruta = `img/uploads/${slug(o.nombre || o.titulo || 'foto')}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.${ext}`;
        pend.set(ruta, { base64, url });
        if (k === 'fotos') (o.fotos ||= []).push('/' + ruta); else o[k] = '/' + ruta;
      } catch (err) { toast('No se pudo leer la foto: ' + err.message, 1); }
    }
    render();
  }
});
app.addEventListener('click', (e) => {
  const b = e.target.closest('button,a'); if (!b) return;
  const d = b.dataset;
  if (d.tab) { view = { tab: d.tab, idx: null, q: '', cat: '' }; return render(); }
  if (d.edit) { view.idx = +d.edit; return render(); }
  if ('back' in d) { e.preventDefault(); view.idx = null; return render(); }
  if (d.new) {
    const nuevo = d.new === 'productos' ? { nombre: '', categoria: view.cat || cats()[0][0], fotos: [], precio: '', precio_anterior: '', medidas: '', material: '', descripcion: '', destacado: false, publicado: true }
      : d.new === 'novedades' ? { titulo: '', etiqueta: 'Novedad', texto: '', foto: '', publicado: true } : { id: '', nombre: '', foto: '' };
    D[d.new].items.unshift(nuevo); view.idx = 0; return render();
  }
  if ('del' in d) {
    const it = target();
    if (!confirm(`¿Eliminar “${it.nombre || it.titulo || 'este elemento'}”? Si solo querés ocultarlo, apagá “Visible en la web”.`)) return;
    [].concat(it.fotos || [], it.foto || []).map(foto).forEach((f) => quitadas.add(f.replace(/^\//, '')));
    D[view.tab].items.splice(view.idx, 1); view.idx = null; return render();
  }
  if (d.rm) {
    const [k, i] = d.rm.split('|'); const o = target();
    let f; if (k === 'fotos') f = foto(o.fotos.splice(+i, 1)[0]); else { f = o[k]; o[k] = ''; }
    quitadas.add(String(f || '').replace(/^\//, ''));
    return render();
  }
  if (d.mv) { const [k, i, s] = d.mv.split('|').map((x, n) => (n ? +x : x)); const a = target()[k]; [a[i], a[i + s]] = [a[i + s], a[i]]; return render(); }
  if ('hadd' in d) { (D.ajustes.horarios ||= []).push({ dias: '', horas: '' }); return render(); }
  if (d.hrm) { D.ajustes.horarios.splice(+d.hrm, 1); return render(); }
});
$('#discard').onclick = () => { if (!confirm('¿Descartar todos los cambios sin guardar?')) return; D = JSON.parse(ORIG); pend.clear(); quitadas.clear(); view.idx = null; render(); };
$('#save').onclick = guardar;
async function guardar() {
  const btn = $('#save');
  const vacio = (p) => !p.nombre?.trim() && !(p.fotos || []).length && !String(p.precio || '').trim() && !p.descripcion?.trim();
  D.productos.items = D.productos.items.filter((p) => !vacio(p));
  if (D.productos.items.some((p) => !p.nombre?.trim())) return toast('Hay un producto sin nombre. Completalo o eliminalo.', 1);
  const o = JSON.parse(ORIG);
  const files = {}; const cambios = [];
  for (const k of Object.keys(D)) if (JSON.stringify(D[k]) !== JSON.stringify(o[k])) { files[k] = limpiar(k, D[k]); cambios.push(TABS.find((t) => t[0] === k)?.[1] || k); }
  const txt = JSON.stringify(files) + JSON.stringify(D);
  const uploads = [...pend].filter(([r]) => txt.includes(r)).map(([path, v]) => ({ path, base64: v.base64 }));
  const deletes = [...quitadas].filter((r) => /^img\/uploads\//.test(r) && !txt.includes(r) && !pend.has(r));
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const r = await api('/api/content', { method: 'POST', body: JSON.stringify({ sha, files, uploads, deletes, summary: 'actualizar ' + cambios.join(', ').toLowerCase() }) });
    sha = r.sha; D = { ...D, ...files }; ORIG = JSON.stringify(D); pend.clear(); quitadas.clear();
    toast('¡Listo! Ya está en la web (puede tardar 1 o 2 minutos en verse).'); render();
  } catch (e) { toast(e.status === 401 ? 'Se venció la sesión. Volvé a entrar (tus cambios siguen acá si no recargás).' : 'No se pudo guardar: ' + e.message, 1); if (e.status === 401) start(); }
  finally { btn.disabled = false; btn.textContent = 'Guardar y publicar'; }
}
function limpiar(k, data) {
  const c = JSON.parse(JSON.stringify(data));
  if (k === 'productos') c.items.forEach((p) => { p.fotos = (p.fotos || []).map(foto).filter(Boolean); ['precio', 'precio_anterior'].forEach((f) => (p[f] = String(p[f] ?? '').trim())); });
  return c;
}
const slug = (s) => (String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'foto');
async function achicar(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(async () => { const i = new Image(); i.src = URL.createObjectURL(file); await i.decode(); return i; });
  const M = 1600, s = Math.min(1, M / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.84));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { base64: btoa(bin), ext, url: URL.createObjectURL(blob) };
}
start();
