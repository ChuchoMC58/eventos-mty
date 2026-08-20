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

## 5. Pendiente para terminar (estado 2026-08-20, sesión de verificación)

**Ya hecho en esta sesión (2026-08-20):**
- `.coolify-agent.env` estaba malformado (token con prefijo basura `2|` →
  `Unauthenticated` en toda llamada API). Corregido; ya sourcea bien.
- Recreados los 3 jobs programados vía API (GET `/applications/{uuid}/scheduled-tasks`
  antes devolvía `[]`):
  - `ingesta` → `npm run ingest` → `0 12 * * *` (uuid `ek4z2do5q…`)
  - `recordatorios` → `npm run reminders` → `0 16 * * *` (uuid `9lwk2cwx…`)
  - `digest` → `npm run digest` → `0 0 * * *` (uuid `q5oczskre…`)
- El fix del Dockerfile y estas docs quedaron squasheadas en **un** commit local
  (`adb5ead`), listo para pushear: `git reset --soft origin/main` + commit +
  `git push origin main` (regla de squash de `AGENTS.md`).

**BLOQUEADOR — esta máquina NO tiene credenciales de push a GitHub.**
No hay `.git-credentials`, `~/.netrc`, claves SSH, helper en config, token GH en
el entorno ni `gh`. (El repo es público y `ls-remote` lee sin auth; escribir no.)
Los pushes previos se hicieron desde otra máquina. Para pushear hay que o bien
configurar aquí un PAT con permiso de escritura, o hacerlo desde el equipo del
usuario. **No disparar deploy manual por API hasta que el fix esté en
`origin/main`** (deploy ahora recompilaría el Dockerfile roto).

Queda, en orden:
1. **Pushear a `main`** el commit `adb5b` (requiere credenciales de push; fuera
   del alcance del agente hoy).
2. **Deploy** — con el fix ya en `origin/main`, un deploy de Coolify compila
   (webhook de GitHub o botón/API). Se verifica `https://vibramx.fun`.
3. **DNS** — mover el registro `A` de `vibramx.fun` (+ `www`) a `93.188.161.137`
   (en el registrador, Hostinger). **Preferible antes del primer deploy con
   dominio** para que Let's Encrypt valide.
4. **Repuntar el webhook de GitHub** (el viejo apunta a la IP del VPS anterior).
   Requiere token GitHub con permiso de webhooks, o hacerlo desde los ajustes del
   repo en la web de GitHub.
5. **Herramientas de dev** (si se sigue trabajando ahí): `cloudflared` en
   `~/.local/bin` (previews por túnel; Hostinger bloquea puertos directos),
   Tailscale, contenedor `cdp` (screenshots/CDP). Ver `AGENTS.md`.
6. **Limpieza de secretos** al final: borrar `/home/idk2858/migracion-restaurada/`,
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