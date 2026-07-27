<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Tests: `npm test` NO toca la BD; los que borran van aparte

(Vigente desde 2026-07-27.)

- **`npm test`** → 45 tests puros, sin Postgres. Seguro de correr en cualquier
  momento, incluso con un preview o el dev server arriba.
- **`npm run test:borra-bd`** → los 5 archivos `*.db.test.ts`. **RESETEAN la BD**,
  pero contra `eventos_mty_test` (el setup `tests/setup-bd.ts` le pega el sufijo
  `_test` a `DATABASE_URL`), nunca contra la de desarrollo.
- **`npm run test:todo`** → los dos; correr antes de pushear.
- `resetDb()` aborta si `DATABASE_URL` no termina en `_test`. Un test nuevo que
  toque la BD **debe** llamarse `*.db.test.ts`.

Contexto: antes un solo `npm test` reseteaba la BD de desarrollo y así se
perdieron los datos locales el 2026-07-27. Detalles en `HANDOFF.md`.

# Flujo de trabajo — todo en `main` local; push SOLO con OK explícito

(Vigente desde 2026-07-23; sustituye al flujo anterior de branch + PR.)

1. Se trabaja directo en `main` local, con commits normales — features, fixes y
   docs (`HANDOFF.md` incluido). Ya NO se crean ramas por feature ni se abren PRs.
2. **NUNCA hagas `git push` sin el OK explícito del usuario en ese momento** —
   el push a `main` deploya a producción (webhook de GitHub → Coolify). Un OK
   anterior no cubre el siguiente push: cada push requiere su propio OK.
3. Al terminar un cambio: commit local, enseñárselo al usuario funcionando (ver
   abajo) y esperar su OK para pushear/deployar.
4. **Squash antes de pushear:** se trabaja con commits normales mientras se itera,
   pero **justo antes de cada push se aplanan los commits pendientes en uno solo**
   con un mensaje que resuma el lote, para que `main` quede con historia limpia.
   Como el ruleset de `main` bloquea force-push (`non_fast_forward`) y `git rebase
   -i` no está disponible en este entorno, el squash se hace localmente antes de
   subir: `git reset --soft origin/main && git commit -m "..."` y luego `git push`.
   (NO intentar squashear commits ya pusheados: requeriría force-push, prohibido.)

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

## Exponer un preview: usar Cloudflare Tunnel (lo más simple)

`cloudflared` ya está instalado en `~/.local/bin/cloudflared`. Es la forma
recomendada de exponer un `next dev` para revisión — el firewall de Hostinger
bloquea los puertos directos (3105, etc.) y enrutar por el Traefik de Coolify
hacia un proceso del host NO funciona (contenedor→host bloqueado). Flujo:

```bash
# 1) dev server en el host contra la BD de prod (via IP del contenedor de la BD)
npx next dev -H 127.0.0.1 -p 3105          # con DATABASE_URL apuntando a la IP del contenedor
# 2) túnel público (URL https aleatoria *.trycloudflare.com):
setsid ~/.local/bin/cloudflared tunnel --url http://localhost:3105 --no-autoupdate > cf.log 2>&1 < /dev/null & disown
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' cf.log   # la URL a compartir
```

Notas: (a) `*.trycloudflare.com` ya está en `allowedDevOrigins` (sin eso React no
hidrata sobre el túnel). (b) El host NO resuelve `trycloudflare.com` por DNS, así
que para auto-verificar la URL hay que curl-earla desde un contenedor con salida a
internet (`docker run --rm node:22-bookworm-slim node -e "fetch(URL)..."`), no
desde el host. (c) Lánzalo con `setsid ... & disown` (no como background task del
harness, que lo reapea).

# Docs de progreso — mantener al día y commitear en `main` local

Para que una sesión nueva no arranque desde cero:

- `HANDOFF.md` — actualizar (fecha de "Última actualización", hecho vs.
  pendiente) y **commitearlo en `main` local** como cualquier archivo; se
  pushea junto con lo demás cuando el usuario dé el OK.
- `README.md` / `DEPLOY-COOLIFY.md` — actualizar solo si el cambio los vuelve
  obsoletos.
<!-- END:nextjs-agent-rules -->
