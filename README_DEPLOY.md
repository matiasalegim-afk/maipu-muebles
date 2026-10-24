# Publicar Maipú Muebles ($0)

Todo gratis: GitHub (plan Free) + Netlify (plan Starter/Free) + Netlify Identity (hasta 5 usuarios gratis) + Decap CMS.

1. **GitHub**: entrá a https://github.com/new, creá el repo `maipu-muebles` (puede ser privado). En esta carpeta:
   ```
   git remote add origin https://github.com/TU_USUARIO/maipu-muebles.git
   git branch -M main
   git push -u origin main
   ```
2. **Netlify**: https://app.netlify.com → *Add new site → Import an existing project → GitHub* → elegí `maipu-muebles`. Build command: vacío. Publish directory: `.` → *Deploy*.
3. En *Site configuration → General → Site details → Change site name* poné `maipumuebles` (queda https://maipumuebles.netlify.app). Si usás otro nombre, cambiá `site_url` en `admin/config.yml`.
4. **Identity**: *Site configuration → Identity → Enable Identity*.
5. *Identity → Registration preferences → Invite only* (nadie se puede registrar solo).
6. *Identity → Services → Git Gateway → Enable Git Gateway*.
7. *Identity → Invite users* → mail de Sofía Chahla. Le llega un mail "You've been invited": hace clic, elige contraseña y entra a https://maipumuebles.netlify.app/admin/
8. (Opcional) Dominio propio: *Domain management*. Es lo único con costo.

Cada vez que Sofía toca **Publicar**, Decap hace un commit en GitHub y Netlify redeploya en ~10–30 segundos.

Prueba local del panel: `npx decap-server` en esta carpeta, descomentar `local_backend: true` en `admin/config.yml` y servir con `python3 -m http.server 8080`.

Nota: Netlify anunció la deprecación de Identity para sitios nuevos en algún momento; si al activarlo no aparece, la alternativa gratuita es backend `github` con OAuth (DecapBridge, gratis) — avisar y se cambia el config.
