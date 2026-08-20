# Migración a este VPS nuevo (srv1915765) — estado a 2026-08-20

Handoff de una migración **en curso** desde el VPS viejo
(`srv1835797` / `187.127.254.144`, muerto e inalcanzable) a este
(`srv1915765` / `93.188.161.137`). Complementa a `MIGRACION-VPS.md`
(montaje del VPS viejo) y a `HANDOFF.md` (estado del proyecto).

> ⚠️ **Este archivo va al repo, que es PÚBLICO.** No lleva secretos: ni
> contraseñas, ni tokens, ni teléfonos. Los valores viven fuera de git
> (listados abajo) y además quedaron en la BD de Coolify.

---

## 0. Qué buscar dónde (estado privado, fuera del repo)

| Qué | Dónde está | Nota |
|---|---|---|
| Respaldo original de migración | `/home/idk2858/respaldo-migracion-20260815.tar.gz` | el `.tar` que trajo el usuario |
| Extraído (secretos en claro, fuera del repo) | `/home/idk2858/migracion-restaurada/respaldo-migracion-20260815/` | `env-dev.txt`, `env-prod.txt`, `prod-eventos_mty-2026-08-15.sql`, `LEEME.txt` |
| 14 env de prod ya resueltas (con `DATABASE_URL` nuevo) | `/home/idk2858/.coolify-app-env.txt` | las empujé a Coolify; borrar al terminar |
| Token API de Coolify | `/home/idk2858/.coolify-agent.env` | solo para el agente |
| UUIDs de recursos de Coolify | `/home/idk2858/.coolify-uuids.env` | proyecto / entorno / base / app |

> El resto (código, conectores, tests) vive en el repo y en GitHub.

---

## 1. Estado de esta instancia

- **Hostinger VPS, hostname `srv1915765`, Ubuntu 24.04**, IP `93.188.161.137`.
  Timezone **UTC** (igual a la vieja → mismos crons en UTC, mismos previews
  que mienten en horas; ver `MIGRACION-VPS.md` §7).
- **Coolify 4.3.9** ya estaba instalado con los 6 contenedores base corriendo:
  `coolify`, `coolify-db`, `coolify-redis`, `coolify-proxy`, `coolify-realtime`,
  `coolify-sentinel`.

## 2. Recursos creados en Coolify (todo vía API REST)

| Qué | UUID | Detalle |
|---|---|---|
| Proyecto `eventos-mty` | (`~/.coolify-uuids.env`) | UUID `1di129jbq…` |
| Entorno `production` | (idem) | UUID `0dctemyan…` |
| BD Postgres 16 (producción) | `2c3vfolyjty…` | contenedor de la app, usuario `eventos`, base `eventos_mty`, **no público**, red docker `coolify` |
| App `eventos-mty` | `chx5kd68ft…` | repo `ChuchoMC58/eventos-mty`, rama `main`, build pack `dockerfile`, puerto `3000`, FQDN `vibramx.fun`+`www.vibramx.fun` |

**Dump de prod restaurado** (9 tablas) — conteos idénticos a los del `LEEME`:
`Event` 146, `Venue` 9, `Source` 2, `User` 1, `SavedEvent` 5, `OtpCode` 15,
`SourceRun` 52, `EventSource` 147, `_prisma_migrations` 3. Datos reales
(events de conciertos reales).

## 3. El bug que rompió el deploy (ya tiene fix local, NO pusheado)

**Falló:** el primer deploy vía Coolify reventó el build en `npm run build` con
`Cannot find module '@tailwindcss/postcss'`.

**Causa (medida, confirmada):** Coolify 4.3.9 inyecta las env de build-time como
`ARG` al inicio del `Dockerfile` (se ve en los logs: ~36 `ARG` al abrir el
archivo). `NODE_ENV=production` estaba marcada `is_buildtime`, y con
`NODE_ENV=production` npm **se salta las devDependencies** (incluida
`@tailwindcss/postcss`, que `globals.css` necesita). En local: con la env en
producción, `npm ci` dejaba `node_modules/@tailwindcss/postcss` **sin crear**.

**Fix (commit local `06e765c`, sin push):** en la etapa `deps` del `Dockerfile`,
forzar devDependencies pese a lo que inyecte un framework:

```diff
-COPY package.json package-lock.json ./
-RUN npm ci
+COPY package.json package-lock.json ./
+RUN NODE_ENV=development npm ci
```

**Comprobado:** `npm install` + `next build` locales verdes, y un
`docker build --build-arg NODE_ENV=production` compila entero (era justo lo que
lo rompía).

## 4. Acceso a Coolify

- **Admin** creado durante la instalación: `admin@vibramx.fun` (contraseña
  no anotar aquí; panel en `http://93.188.161.137:8000`).
- **API de Coolify** estaba **desactivada por defecto** → la habilité en
  `instance_settings` y creé un token (valor en `~/.coolify-…`, fuera del repo).

## 5. Pendiente para terminar (estado 2026-08-20, sesión de migración)

**Ya hecho (verificado en esta sesión 2026-08-20):**
- `.coolify-agent.env` estaba malformado (token con prefijo basura `2|` →
  `Unauthenticated` en toda llamada API). Corregido; ya sourcea bien.
- Instalado **GitHub CLI (`gh` 2.97.0)** desde el repo oficial (`cli.github.com`)
  y autenticado como `ChuchoMC58` (token `gho_`, scopes `repo` + `workflow`).
  Puse `gh auth setup-git` como credential helper de git.
- Recreados los 3 jobs programados vía API (GET `/applications/{uuid}/scheduled-tasks`
  antes devolvía `[]`):
  - `ingesta` → `npm run ingest` → `0 12 * * *` (uuid `ek4z2do5q…`)
  - `recordatorios` → `npm run reminders` → `0 16 * * *` (uuid `9lwk2cwx…`)
  - `digest` → `npm run digest` → `0 0 * * *` (uuid `q5oczskre…`)
- **Push hecho:** squash de los 2 commits pendientes en uno (`adb5ead`: fix
  Dockerfile + docs) y pusheado a `main` (`b9fef5c..5379c  main -> main`).
- **Deploy hecho y VERDE:** disparado por API (`POST /api/v1/deploy` con
  `{"uuid": app, "force": true}`, no es `/applications/{uuid}/deploy`). El deploy
  `ihdqmsxx…` terminó `finished`, la app pasó de `exited:unhealthy` a
  `running:unknown`, y el contenedor arrancó con `next start` correcto. La web
  ya sirve por el proxy de Coolify y devuelve el HTML real:
  `<title>Vibra MX — qué hacer en Monterrey</title>`. BD con datos intactos:
  `Event` **146**, `Venue` 9, `User` 1.

> ⚠️ Nota deploy: el toggle del proxy `http://127.0.0.1` con Host `vibramx.fun`
> responde 302 → https, y `https://127.0.0.1` con ese Host devuelve **200**
> (se sirve la app, sin DNS). El puerto 3000 del contenedor no está publicado
> externamente; Coolify enruta por la red docker interna.

**Queda (solo posible por ti/usuario):**
1. **DNS** — mover el registro `A` de `vibramx.fun` (+ `www`) a `93.188.161.137`
   en el registrador (Hostinger). Hoy siguen apuntando al VPS muerto
   (`187.127.254.144`). Es lo único que impide que `https://vibramx.fun`
   funcione desde fuera (la app ya corre en el VPS nuevo).
2. **Webhook de GitHub** — repuntarlo hacia el VPS nuevo (el viejo apunta a la IP
   del VPS anterior). Con `gh` ya autenticado se puede tocar por API desde aquí
   (`gh api repos/ChuchoMC58/eventos-mty/hooks`), pero **no conviene activarlo
   aún**: hacerlo mientras el DNS siga apuntando al VPS viejo puede disparar
   deploys/notificaciones a la IP antigua. Mejor setarlo a la IP nueva cuando el
   DNS esté movido, o hacerlo desde los ajustes del repo en la web.
3. **Herramientas de dev** (si se sigue trabajando ahí): `cloudflared` en
   `~/.local/bin` (previews por túnel; Hostinger bloquea puertos directos),
   Tailscale, contenedor `cdp` (screenshots/CDP). Ver `AGENTS.md`.
4. **Limpieza de secretos** al final: borrar `/home/idk2858/migracion-restaurada/`,
   el `.tar` original y `~/.coolify-app-env.env` (si ya no hacen falta).

## 6. Trampas heredadas del otro VPS

- **El host está en UTC** — todo preview miente en horas. Levantar siempre con
  `TZ=America/Monterrey`.
- **`docker`/`sudo` fallan en sesiones viejas de tmux** — usar `sg docker` o
  login nuevo.
- **Push a `main` = deploy a producción** (no hay staging).
- La BD de tests NO se migra sola — tras `prisma migrate dev`, correr
  `prisma migrate deploy` contra `eventos_mty_test`.
- `npm test` vs `npm run test:borra-bd`: el segundo borra la BD (sufijo
  `.db.test.ts` en el archivo, no el conteo).