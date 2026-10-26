let WA='5493816566975';
const ars=v=>{if(v==null||v==='')return '';const n=Number(String(v).replace(/[^\d,]/g,'').replace(',','.'));return n>0?'$ '+Math.round(n).toLocaleString('es-AR'):String(v)};
const priceHTML=p=>{const a=ars(p.precio),o=ars(p.precio_anterior);return a?`${o&&o!==a?`<s class="price__old">${o}</s> `:''}<span class="price__now">${a}</span>`:'<span class="price__ask">Consultar precio</span>'};
const wa=t=>`https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
// Contenido en vivo desde GitHub: lo que Sofía guarda en el panel se ve sin esperar un deploy de Netlify
const RAW='https://raw.githubusercontent.com/matiasalegim-afk/maipu-muebles/main/';
const up=v=>typeof v==='string'?(/^\/?img\/uploads\//.test(v)?RAW+v.replace(/^\//,''):v):Array.isArray(v)?v.map(up):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,up(x)])):v;
const get=f=>fetch(`${RAW}content/${f}.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw r.status;return r.json()}).then(up).catch(()=>fetch(`content/${f}.json`,{cache:'no-cache'}).then(r=>r.json()));
const th=f=>/^\/?img\/(productos\/)?[^/]+\.webp$/.test(f)?f.replace(/\.webp$/,'-600.webp'):f;
const pic=p=>{const f=(p.fotos||[])[0];return f?(typeof f==='string'?f:f.foto):'img/local.webp'};
// Netlify Identity: redirect invited users to /admin after login
if(window.netlifyIdentity){netlifyIdentity.on('init',u=>{if(!u)netlifyIdentity.on('login',()=>{location.href='/admin/'})})}
let P=[],label={};
async function init(){
 const [home,aj,cats,prods,news]=await Promise.all(['home','ajustes','categorias','productos','novedades'].map(get));
 WA=aj.whatsapp||WA;
 $('hero-eyebrow').textContent=home.hero_eyebrow;
 $('hero-title').innerHTML=home.hero_titulo.split('|').map(l=>{const it=/^\*.*\*$/.test(l);l=esc(l.replace(/^\*|\*$/g,''));return `<span class="line"><span>${it?`<i>${l}</i>`:l}</span></span>`}).join('');
 $('hero-text').textContent=home.hero_texto;
 $('nos-title').textContent=home.nosotros_titulo;$('nos-text').textContent=home.nosotros_texto;
 ['cuotas','envio','posventa'].forEach(k=>$('t-'+k).textContent=aj[k]);
 $('hours').innerHTML=(aj.horarios||[]).map(h=>`<div><dt>${esc(h.dias)}</dt><dd>${esc(h.horas)}</dd></div>`).join('');
 document.querySelectorAll('a[href^="tel:"]').forEach(a=>{a.href='tel:+'+WA.replace(/^549/,'54');if(/\d/.test(a.textContent))a.textContent=aj.telefono_visible||a.textContent});
 cats.items.forEach(c=>label[c.id]=c.nombre);
 $('cats').innerHTML=cats.items.map((c,n)=>`<a href="#catalogo" data-filter="${esc(c.id)}" class="cat${n?'':' cat--lg'}"><div class="mask"><img loading="lazy" decoding="async" src="${esc(th(c.foto))}"${!n&&th(c.foto)!==c.foto?` srcset="${esc(th(c.foto))} 600w, ${esc(c.foto)} 1600w" sizes="(max-width:900px) 100vw, 60vw"`:''} alt="${esc(c.nombre)}" width="1100" height="733"></div><span class="cat__n">${String(n+1).padStart(2,'0')}</span><h3>${esc(c.nombre)}</h3></a>`).join('');
 P=prods.items.filter(p=>p.publicado!==false).sort((a,b)=>(b.destacado?1:0)-(a.destacado?1:0));
 const used=cats.items.filter(c=>P.some(p=>p.categoria===c.id));
 $('filters').innerHTML=`<button class="chip is-on" data-f="todos">Todo</button>`+used.map(c=>`<button class="chip" data-f="${esc(c.id)}">${esc(c.nombre)}</button>`).join('');
 $('grid').innerHTML=P.map((p,i)=>`<button class="card" data-c="${esc(p.categoria)}" data-i="${i}"><div class="mask"><img loading="lazy" decoding="async" src="${esc(th(pic(p)))}" alt="${esc(p.nombre)}" width="1100" height="1375"></div><div class="card__meta"><div><h3>${esc(p.nombre)}</h3><p>${esc(label[p.categoria]||'')}</p><p class="price">${priceHTML(p)}</p></div><span class="card__go">Ver ficha</span></div></button>`).join('');
 const N=news.items.filter(n=>n.publicado!==false);
 if(!N.length)$('novedades').hidden=true;
 $('news').innerHTML=N.map(n=>`<article class="news__item reveal">${n.foto?`<img loading="lazy" decoding="async" src="${esc(th(n.foto))}" alt="${esc(n.titulo)}">`:''}<div><span class="tag${/oferta/i.test(n.etiqueta)?' tag--oferta':''}">${esc(n.etiqueta||'Novedad')}</span><h3>${esc(n.titulo)}</h3><p>${esc(n.texto)}</p></div></article>`).join('');
 document.querySelectorAll('[data-wa]').forEach(a=>{a.href=wa(a.dataset.wa);a.target='_blank';a.rel='noopener'});
 const g=$('grid'),sheet=$('sheet');
 g.addEventListener('click',e=>{const b=e.target.closest('.card');if(!b)return;const p=P[b.dataset.i];
  $('sheet-img').src=pic(p);{const F=(p.fotos||[]).map(f=>typeof f==='string'?f:f.foto);$('sheet-thumbs').innerHTML=F.length>1?F.map((f,k)=>`<button type="button" aria-label="Ver foto ${k+1} de ${F.length}" aria-pressed="${!k}" class="${k?'':'on'}" data-src="${esc(f)}"><img src="${esc(th(f))}" alt="" loading="lazy"></button>`).join(''):'';}$('sheet-img').alt=p.nombre;$('sheet-cat').textContent=label[p.categoria]||'';$('sheet-title').textContent=p.nombre;$('sheet-desc').textContent=p.descripcion||'';
  $('sheet-specs').innerHTML=[['Medidas',p.medidas],['Material',p.material]].filter(x=>x[1]).map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('sheet-price').innerHTML=priceHTML(p);
  $('sheet-wa').textContent=ars(p.precio)?'Consultar por WhatsApp':'Consultar precio por WhatsApp';$('sheet-wa').href=wa(ars(p.precio)?`Hola Maipú Muebles, quería consultar stock y cuotas de: ${p.nombre} (${ars(p.precio)})`:`Hola Maipú Muebles, quería consultar precio y stock de: ${p.nombre}`);sheet.showModal();});
 sheet.addEventListener('click',e=>{if(e.target===sheet||e.target.hasAttribute('data-close'))sheet.close()});
 const filt=f=>{document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('is-on',c.dataset.f===f));g.querySelectorAll('.card').forEach(c=>c.classList.toggle('is-out',f!=='todos'&&c.dataset.c!==f));window.ScrollTrigger&&ScrollTrigger.refresh()};
 document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>filt(c.dataset.f));
 document.querySelectorAll('[data-filter]').forEach(a=>a.addEventListener('click',()=>{const f=a.dataset.filter;filt(document.querySelector(`.chip[data-f="${f}"]`)?f:'todos')}));
}
function motion(){
 if(!window.gsap||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 gsap.registerPlugin(ScrollTrigger);
 if(window.Lenis){const l=new Lenis({lerp:.1});l.on('scroll',ScrollTrigger.update);gsap.ticker.add(t=>l.raf(t*1000));gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const t=a.getAttribute('href');if(t.length>1&&document.querySelector(t)){e.preventDefault();l.scrollTo(t,{offset:-60})}}));}
 const E='expo.out';
 gsap.from('.hero .line>span',{yPercent:110,duration:1.3,ease:E,stagger:.09,delay:.1});
 gsap.from('.hero__media .mask',{clipPath:'inset(100% 0 0 0)',duration:1.5,ease:E,delay:.2});
 gsap.from('.hero__media img',{scale:1.2,duration:2,ease:E,delay:.2});
 gsap.from('.hero .reveal',{y:24,opacity:0,duration:1,ease:E,stagger:.1,delay:.6});
 gsap.utils.toArray('.parallax').forEach(i=>gsap.fromTo(i,{yPercent:-8},{yPercent:0,ease:'none',scrollTrigger:{trigger:i.parentElement,start:'top bottom',end:'bottom top',scrub:true}}));
 gsap.utils.toArray('.split').forEach(h=>{gsap.from(h,{y:40,opacity:0,duration:1.2,ease:E,scrollTrigger:{trigger:h,start:'top 88%'}})});
 gsap.utils.toArray('.section .reveal').forEach(r=>gsap.from(r,{y:32,opacity:0,duration:1,ease:E,scrollTrigger:{trigger:r,start:'top 90%'}}));
 gsap.utils.toArray('.cat .mask, .card .mask, .medida__media').forEach(m=>gsap.from(m,{clipPath:'inset(0 0 100% 0)',duration:1.3,ease:E,scrollTrigger:{trigger:m,start:'top 92%'}}));
 gsap.utils.toArray('.cta__bars i').forEach((b,i)=>gsap.from(b,{scaleY:0,transformOrigin:'top',duration:1.4,ease:E,delay:i*.12,scrollTrigger:{trigger:'.cta',start:'top 75%'}}));

}
// nav
const nav=document.getElementById('nav');let ly=0;
addEventListener('scroll',()=>{const y=scrollY;nav.classList.toggle('is-solid',y>40);nav.classList.toggle('is-hidden',y>ly&&y>500);ly=y},{passive:true});
// map
const mapInit=()=>{if(!window.L||mapInit.done)return;mapInit.done=1;const c=[-26.825267,-65.206527];const m=L.map('map',{scrollWheelZoom:false,zoomControl:false}).setView(c,16);
 L.control.zoom({position:'bottomright'}).addTo(m);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
 L.marker(c,{icon:L.divIcon({className:'',html:'<div class="pin"><i></i><i></i><i></i></div>',iconSize:[44,44],iconAnchor:[22,44]}),alt:'Maipú Muebles',keyboard:false}).addTo(m).bindPopup('<b>Maipú Muebles</b><br>Maipú 384');};
addEventListener('load',()=>{const el=document.getElementById('map');if(!el)return;if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();mapInit()}},{rootMargin:'400px'});io.observe(el)}else mapInit()});

init().catch(e=>{console.warn('content',e);const g=$('grid');if(g&&!g.children.length)g.innerHTML='<p class="lead">No pudimos cargar el catálogo. Escribinos por WhatsApp y te pasamos fotos y precios.</p>'}).finally(motion);

(()=>{const n=document.getElementById('nav'),b=document.getElementById('burger');if(!b)return;const set=o=>{n.classList.toggle('is-open',o);b.setAttribute('aria-expanded',o);b.setAttribute('aria-label',o?'Cerrar menú':'Abrir menú');document.documentElement.style.overflow=o?'hidden':''};b.addEventListener('click',()=>set(!n.classList.contains('is-open')));n.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>set(false)));addEventListener('keydown',e=>e.key==='Escape'&&set(false))})();

document.getElementById('sheet-thumbs')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;document.getElementById('sheet-img').src=b.dataset.src;b.parentNode.querySelectorAll('button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b)})});
