<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Flujo de trabajo — todo en `main` local; push SOLO con OK explícito

(Vigente desde 2026-07-23; sustituye al flujo anterior de branch + PR.)

1. Se trabaja directo en `main` local, con commits normales — features, fixes y
   docs (`HANDOFF.md` incluido). Ya NO se crean ramas por feature ni se abren PRs.
2. **NUNCA hagas `git push` sin el OK explícito del usuario en ese momento** —
   el push a `main` deploya a producción (webhook de GitHub → Coolify). Un OK
   anterior no cubre el siguiente push: cada push requiere su propio OK.
3. Al terminar un cambio: commit local, enseñárselo al usuario funcionando (ver
   abajo) y esperar su OK para pushear/deployar.

# Al terminar un fix/feature — dejar la app corriendo en vivo para revisar

Cuando termines un fix o feature, **corre la app en vivo** y comparte la URL
para que el usuario lo revise antes de darlo por cerrado:

- Si ya está pusheado/en producción, comparte la URL de prod y confirma que el
  cambio se ve ahí.
- Si sigue como commit local sin pushear (pendiente del OK), levanta la app
  (dev server contra la BD del contenedor, ver [flujo de verificación local]) y
  comparte la URL/puerto.

No basta con tests o build verdes: el usuario quiere ver el cambio funcionando
en la app real.

## ⚠️ Previews con `next dev`: hidratación y orígenes permitidos

Dos trampas ya pisadas (2026-07-23) al levantar el dev server para revisión:

1. **Next 16 bloquea los chunks JS del dev server desde orígenes no listados**
   (`127.0.0.1`, la IP del VPS, dominios `*.sslip.io`) → la página carga SIN
   JavaScript y los componentes cliente parecen rotos (así nació el falso bug de
   "el input de teléfono acepta letras"). El origen del preview debe estar en
   `allowedDevOrigins` de `next.config.ts`. Si un componente cliente "no
   reacciona" en un preview, verifica esto ANTES de tocar el código. Solo aplica
   a `next dev`; producción no se ve afectada.
2. **Si Turbopack da FATAL "Permission denied" en `.next`**: hay residuos owned
   por root de corridas dockerizadas. Borrar `.next` completo (vía contenedor si
   hace falta) y dejar que recompile.

# Docs de progreso — mantener al día y commitear en `main` local

Para que una sesión nueva no arranque desde cero:

- `HANDOFF.md` — actualizar (fecha de "Última actualización", hecho vs.
  pendiente) y **commitearlo en `main` local** como cualquier archivo; se
  pushea junto con lo demás cuando el usuario dé el OK.
- `README.md` / `DEPLOY-COOLIFY.md` — actualizar solo si el cambio los vuelve
  obsoletos.
<!-- END:nextjs-agent-rules -->
