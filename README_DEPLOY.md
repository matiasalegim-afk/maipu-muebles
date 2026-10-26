# Maipú Muebles en Cloudflare Pages (gratis)

- Sitio estático (build vacío, salida `.`). La web lee `content/*.json` y `img/uploads/*` en vivo desde GitHub (raw), así los cambios del panel se ven sin esperar deploy.
- Panel propio en `/admin/` + Pages Functions en `functions/api/` (`session` = login con código de 6 dígitos por mail (10 min, máx 5 intentos, 1 envío/min y 5/hora por mail, sesión firmada 30 días), `content` = leer/guardar). Cada "Guardar y publicar" = **un** commit (JSON + fotos nuevas + fotos borradas) vía API de GitHub.

## Variables (Cloudflare → Workers & Pages → maipumuebles → Settings → Variables and Secrets, Production)
| Nombre | Tipo | Valor |
|---|---|---|
| `BREVO_API_KEY` | Secret | API key de Brevo (plan gratis, 300 mails/día, sin tarjeta). Alternativa: `RESEND_API_KEY` |
| `MAIL_FROM` | Text | Remitente verificado en Brevo (Senders), ej. `matiasalegim@gmail.com` |
| `MAIL_FROM_NAME` | Text (opcional) | Por defecto `Maipú Muebles` |
| `GITHUB_TOKEN` | Secret | Fine-grained token, solo repo `maipu-muebles`, permiso Contents: Read and write |
| `SESSION_SECRET` | Secret | 48+ caracteres aleatorios |
| `ADMIN_EMAILS` | Text (opcional) | Por defecto `matiasalegim@gmail.com,sofiachahla17@gmail.com` |

Opcional (recomendado): binding KV `LOGIN_KV` (Settings → Bindings → KV namespace, gratis) para que los límites de intentos sean globales. Sin KV se usa la Cache API del datacenter.

### Brevo (una vez, en navegador)
1. Crear cuenta gratis en brevo.com (sin tarjeta) con el Gmail de Matías.
2. Senders, Domains & IPs → Senders → agregar `matiasalegim@gmail.com` y confirmar el mail que llega.
3. SMTP & API → API Keys → Generate → pegarla como `BREVO_API_KEY`.

## Desarrollo / pruebas
`npm test` (login por código: permisos, vencimiento, intentos, límites de envío, Brevo/Resend; sesión, commit único, conflictos). Local: `.dev.vars` con las variables (+ `BRANCH=panel-test` para no tocar main) y `npm run dev`.
