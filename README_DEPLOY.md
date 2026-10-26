# Maipú Muebles en Cloudflare Pages (gratis)

- Sitio estático (build vacío, salida `.`). La web lee `content/*.json` y `img/uploads/*` en vivo desde GitHub (raw), así los cambios del panel se ven sin esperar deploy.
- Panel propio en `/admin/` + Pages Functions en `functions/api/` (`session` = login Google, `content` = leer/guardar). Cada "Guardar y publicar" = **un** commit (JSON + fotos nuevas + fotos borradas) vía API de GitHub.

## Variables (Cloudflare → Workers & Pages → maipumuebles → Settings → Variables and Secrets, Production)
| Nombre | Tipo | Valor |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Text | Client ID web de Google (`…apps.googleusercontent.com`) |
| `GITHUB_TOKEN` | Secret | Fine-grained token, solo repo `maipu-muebles`, permiso Contents: Read and write |
| `SESSION_SECRET` | Secret | 48+ caracteres aleatorios |
| `ADMIN_EMAILS` | Text (opcional) | Por defecto `matiasalegim@gmail.com,sofiachahla17@gmail.com` |

## Desarrollo / pruebas
`npm test` (login Google con firma RSA real, sesión, commit único, conflictos). Local: `.dev.vars` con las variables (+ `BRANCH=panel-test` para no tocar main) y `npm run dev`.
