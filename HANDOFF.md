# Eventos MTY — Handoff / Estado del proyecto

> Documento de continuidad para retomar el trabajo en una sesión nueva.
> Última actualización: 2026-07-23.

## Qué es

Agregador de eventos de Monterrey (música, deportes, cultura) con cartelera web
pública + digest semanal y recordatorios por WhatsApp. Monolito Next.js + Postgres
(Prisma). Todo el texto de usuario en español. Ver `docs/` para el spec y el plan
completos si están presentes.

## Estado: FASE 0–4 COMPLETAS. App DESPLEGADA en Coolify.

- **46 tests pasan** (`npm test`), **build de producción limpio** (`npm run build`).
- Commits por fase (rama `main`, ya en GitHub `ChuchoMC58/eventos-mty`, público):
  - `fase 0` scaffold + esquema BD
  - `fase 1` ingesta (conectores, dedupe, salud de fuentes)
  - `fase 2` cartelera web (explorar, detalle, calendario)
  - `fase 3` usuarios, digest y recordatorios por WhatsApp
  - `fase 4` despliegue en Coolify (VPS Hostinger). **App en vivo:**
    https://m58mjf955rtyr48celfqjg2a.187.127.254.144.sslip.io
- **Despliegue:** Coolify en el propio VPS. Postgres gestionado por Coolify
  (separado de la BD dev local). Auto-deploy activo: `git push` a `main` →
  webhook de GitHub → Coolify reconstruye y redespliega. HTTPS (Let's Encrypt).
- Prod tiene **82 eventos reales** de Ticketmaster (ingesta corrida 2026-07-22);
  los 6 eventos demo del `prisma db seed` ya fueron borrados. BD prod ≠ BD local.
- Auto-deploy verificado end-to-end: `git push` a `main` → webhook de GitHub →
  Coolify reconstruye y cambia el contenedor (~2–3 min medidos).
- **Rediseño UI "Marquesina" en producción (2026-07-21):** cartelera nocturna —
  tokens Tailwind v4 (tinta/hueso/humo + categorías ámbar/verde/lila), fuente
  display Archivo Black, home con agenda agrupada por día (Hoy/Mañana), filtros
  como chips, CTA de WhatsApp en el hero, y todas las páginas/formularios con el
  mismo lenguaje visual. Se eligió entre 2 prototipos (quedan sin trackear en
  `design/` local). `formatPrecio` ahora usa separador de miles.

## Continuidad del entorno (VPS persistente)

**Corrección importante:** este NO es un sandbox efímero — es un **VPS real de Hostinger**
donde además corre **Coolify** (la plataforma de despliegue). El proyecto y sus
herramientas ya están instalados y persisten entre sesiones. Node se instaló vía nvm
y Postgres a nivel de usuario (sin root/Docker para el entorno de dev local); el
despliegue en cambio usa Coolify (provee su propio Postgres y build). Los pasos de abajo
son de REFERENCIA por si algún día hay que reconstruir el tooling de dev local:

### Node.js (vía nvm, sin root)
```bash
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22
# symlinks para que node/npm/npx estén en PATH sin sourcing:
for b in node npm npx; do ln -sf "$HOME/.nvm/versions/node/$(nvm version 22 | sed 's/^v//; s/^/v/')/bin/$b" "$HOME/.local/bin/$b"; done
```

### PostgreSQL 16 (user-level, sin root/Docker)
Se descargaron los .deb y se extrajeron a `~/pgsql/root`. Wrappers en `~/.local/bin`
(pg_ctl, psql, initdb, etc.) que fijan `LD_LIBRARY_PATH` y `PGDATA`.
```bash
# Arrancar el server (datadir ya inicializado en ~/pgsql/data):
pg_ctl -D ~/pgsql/data -l ~/pgsql/logfile -o "-k $HOME/pgsql/run -h 127.0.0.1 -p 5432" start
# Si ~/pgsql no existe, reinstalar:
#   apt-get download postgresql-16 postgresql-client-16 postgresql-common \
#     postgresql-client-common libpq5 ssl-cert
#   dpkg-deb -x cada .deb en ~/pgsql/root ; initdb -D ~/pgsql/data -U postgres --auth=trust
#   createdb -h 127.0.0.1 -U postgres eventos_mty ; ALTER USER postgres PASSWORD 'postgres'
```
`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/eventos_mty`

## Comandos de trabajo
```bash
cd ~/eventos-mty
npm install                 # si node_modules no está
npx prisma migrate deploy   # aplicar migraciones a la BD
npx prisma db seed          # 6 eventos de ejemplo
npm test                    # 46 tests (usa la BD local; la vacía con resetDb)
npm run dev                 # http://localhost:3000
npm run build               # build de producción
npm run ingest|digest|reminders   # jobs CLI
```
Nota: correr `npm test` VACÍA la BD (los tests de integración usan `resetDb`).
Volver a correr `npx prisma db seed` para tener datos en la web tras los tests.

## Desviaciones del plan original (todas justificadas)
1. **Prisma fijado a v6** (no v7). Prisma 7 cambió el generador (`prisma-client`,
   `prisma.config.ts`, output custom, no auto-.env) — incompatible con el código y
   los tests del plan que asumen v6 (`prisma-client-js`, `url=env()`, import de
   `@prisma/client`). v6 es estable y compatible con Next 16.
2. **Next.js 16** (el scaffold instaló 16, no 15). El código del plan ya usa las
   APIs async (`await params/searchParams/cookies`) que Next 16 exige. Compatible.
   Hay un `AGENTS.md` que apunta a los docs embebidos en `node_modules/next/dist/docs`.
3. **Fix en `tests/otp.test.ts`**: se añadió `WHATSAPP_TEST_MODE=false` en el
   `beforeEach`. En modo prueba, `sendWhatsApp` antepone `[PRUEBA → +52...]` y el
   regex `/\d{6}/` del test capturaba dígitos del teléfono en vez del código OTP.
4. **Entorno**: Node por nvm+symlinks, Postgres user-level (sin Docker/root en el
   sandbox). En el VPS con Coolify esto no aplica: Coolify provee Postgres y build.
5. **FASE 4 reescrita para Coolify** (el plan original decía Railway). Ver
   `DEPLOY-COOLIFY.md`.

## FASE 4 — hecho vs. pendiente

**Ya hecho (desplegado y verificado):**
- ✅ App en vivo en Coolify con HTTPS (Let's Encrypt), Postgres gestionado por Coolify,
  migraciones al arrancar.
- ✅ **Datos reales de Ticketmaster en prod (2026-07-22):** `TICKETMASTER_API_KEY`
  configurada como env var en Coolify; ingesta corrida → **82 eventos reales** de
  Monterrey (Maroon 5, Rod Stewart, ZZ Top…). Los 6 eventos demo (`prisma db seed`)
  fueron **borrados** de prod.
- ✅ Repo público en GitHub (`ChuchoMC58/eventos-mty`), auto-deploy on push a `main`
  vía webhook de GitHub.
- ✅ Acceso operativo: `gh` CLI autenticado; token de API de Coolify; acceso Docker
  al stack. (Detalles sensibles —UUIDs, ubicación de secretos— en la memoria privada
  del agente, NO en este repo público.)

**Pendiente (requiere acción del usuario):**
- ~~Twilio: `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM`~~ ✅ **HECHO y VERIFICADO
  (2026-07-23):** cuenta Twilio creada; **WhatsApp Sandbox** conectado. Las cinco
  env vars están en Coolify: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_WHATSAPP_FROM=+14155238886`, `ADMIN_WHATSAPP=+5219223736016` (número del
  usuario, ya suscrito con `join though-excellent`) y `WHATSAPP_TEST_MODE=true`.
  Probado end-to-end: `POST /api/auth/request-code` → HTTP 200 y el OTP llegó al
  WhatsApp del admin con el prefijo `[PRUEBA → …]`. Es **sandbox** (solo entrega a
  números que hayan hecho `join`; caduca ~72 h de inactividad) → sirve para dev, NO
  para usuarios reales. Ver [[whatsapp-mx-521-format]] para el riesgo del `+521`.
- **Claves de terceros** restantes:
  - `ANTHROPIC_API_KEY` ya NO es urgente: era para el fallback LLM del conector
    de Citibanamex, que se eliminó (2026-07-23). Solo se necesitará si un venue
    futuro requiere el fallback LLM.
- **Modo prueba WhatsApp**: `WHATSAPP_TEST_MODE=true` hasta que las plantillas de
  Meta estén aprobadas y el digest se vea correcto una semana. NUNCA ponerlo en
  `false` antes de eso. ⚠️ ANTES de apagarlo: verificar el formato `+521` con un
  número mexicano real (la app guarda `+52` sin el `1`; ver `src/lib/auth/phone.ts`).
- ~~URLs reales de conectores de página~~ ✅ **RESUELTO y EN PROD (2026-07-23):**
  la cartelera de la Arena es una SPA sin JSON-LD — se descubrió su API real
  (`api.arenamonterrey.com/next_event_dates`) y se escribió un conector dedicado
  (`src/lib/ingest/sources/arena-monterrey.ts`): **47 eventos** (vende por
  Superboletos; TM solo traía 1). El de Citibanamex se **eliminó**: TM ya cubre ese
  venue ("Auditorio Banamex", 29 eventos). Dedupe verificado (Melanie Martinez =
  1 evento, 2 fuentes). Desplegado, ingesta corrida en prod (130 eventos activos) y
  Sources huérfanos (`auditorio-citibanamex`, `seed`) borrados de la BD prod.
  Nota GitHub: el ruleset de `main` ya NO exige PR (se quitó para el flujo de push
  directo); conserva no-borrado y no-force-push.
- ~~Tareas programadas en Coolify~~ ✅ **HECHO (2026-07-23):** Scheduled Tasks
  creadas vía API y verificadas: `ingesta` (06:00 MTY / `0 12 * * *` UTC),
  `recordatorios` (10:00 / `0 16 * * *`), `digest` (18:00 / `0 0 * * *`).
  Verificado end-to-end: ingest corre dentro del contenedor (83 eventos TM) y el
  scheduler de Coolify dispara solo (ejecución de prueba `success`). Los conectores
  de Arena (404) y Citibanamex (falta `ANTHROPIC_API_KEY`) siguen fallando — la
  ingesta diaria vive de Ticketmaster mientras tanto.
- **Expansión nacional (futuro):** el conector de Ticketmaster está fijo a
  `city=Monterrey`. Para abrir otras ciudades habrá que parametrizarlo por ciudad y
  añadir `ciudad`/región a la navegación.
- **Dominio real** (opcional): hoy usa un dominio auto `*.sslip.io`. Para links de
  WhatsApp conviene un dominio propio apuntando a la IP del VPS.

**Pendiente (código — siguiente sesión):**
- Refinamiento visual fino del rediseño (el usuario quiere funcionalidad primero,
  pulir al final).

**Resuelto (2026-07-23):**
- ✅ **Nuevo flujo de trabajo (ver `AGENTS.md`):** ya NO se usan ramas ni PRs — todo
  se commitea directo en `main` local (HANDOFF incluido) y **nada se pushea sin el OK
  explícito del usuario** (el push deploya a prod). Los PRs #1–#8 son del flujo viejo.
- ✅ **`UID` + `METHOD:PUBLISH` en el `.ics`** (PR #8, mergeado y verificado en prod):
  el `UID` lo exige el RFC 5545 y faltaba. El preview temporal (`preview-ics`) ya fue
  desmontado (contenedor + yaml del proxy).
- ✅ **CERRADO el caso "`.ics` no abre directo a guardar en Outlook": no es arreglable
  desde el archivo.** El nuevo Outlook (Windows) ya no abre la ventana del evento al
  abrir un `.ics` — Microsoft lo confirma como comportamiento esperado; el diálogo de
  importar solo aparece yendo a mano a la vista de Calendario (o Agregar calendario >
  Cargar desde archivo). Ningún `METHOD`/estructura lo cambia. Se probó un botón
  "Outlook" con deeplink web (`outlook.live.com/calendar/deeplink/compose`, sí abre el
  formulario prellenado) pero **el usuario lo descartó** — no reintroducirlo. De la
  rama solo queda el fix de formato del PR #8.
- ✅ **Recordatorio de 2 h en Google: NO se puede vía el link** — el `TEMPLATE` de
  Google Calendar no admite parámetro de recordatorio (confirmado 2026-07-23); el
  evento toma las notificaciones default de la cuenta del usuario. Alternativas
  descartadas: importar el `.ics` (Google sí respeta el `VALARM` pero el flujo es
  engorroso) y la API con OAuth (excesivo). **Decisión: apoyarse en los recordatorios
  de WhatsApp propios**, donde controlamos la anticipación.
- ✅ **"El input de teléfono acepta letras" era un falso bug del preview** (PR #6,
  rama `feat/telefono-estandarizado`): el código del input siempre estuvo bien; Next 16
  **bloquea los chunks JS del dev server cuando se abre desde un origen distinto a
  localhost** (la IP o un dominio `*.sslip.io`) → la página cargaba SIN JavaScript y el
  input quedaba muerto (aceptaba cualquier cosa). Arreglado con `allowedDevOrigins` en
  `next.config.ts` (solo afecta a `next dev`; prod nunca tuvo este problema). Verificado
  tecleando en un Chrome real vía el dominio del preview: letras bloqueadas, tope de 10,
  botón habilitado justo a los 10 dígitos.
- ✅ **Pegar el número con lada ya no lo corrompe** (mismo PR #6): pegar
  `+52 (81) 8765-4321` metía `5281876543` (número equivocado en silencio). El input ahora
  usa el mismo helper del servidor (`mxNationalDigits`) y queda `8187654321`. Con test
  unitario nuevo (`tests/phone.test.ts`, 9 casos).
- ⚠️ Lección para verificar previews de dev server: si un componente cliente "no
  reacciona", revisar primero que el origen esté en `allowedDevOrigins` — sin eso React
  no hidrata. Y si Turbopack da FATAL "Permission denied" en `.next`, borrar `.next`
  completo (residuos root de corridas dockerizadas).

**Resuelto (2026-07-22):**
- ✅ **Recordatorio de 2 h en el `.ics`** (`src/lib/calendar.ts`): `buildIcs` ahora
  incluye un bloque `VALARM` con `TRIGGER:-PT2H`, así el botón "Apple/Outlook (.ics)"
  agrega el evento con recordatorio 2 h antes (Apple/Outlook/Google lo respetan al
  importar). El botón de Google Calendar usa un link `TEMPLATE` que NO admite fijar
  recordatorio por URL, así que ahí sigue el default de la cuenta del usuario.
  Verificado en vivo: el `.ics` de un evento real trae el `VALARM`.

**Resuelto (2026-07-21):**
- ✅ **`SaveButton` montado en la página de detalle** (`src/app/eventos/[id]/page.tsx`):
  lee la sesión, consulta si el evento ya está guardado y el `reminderPref` del
  usuario. Verificado end-to-end contra la BD del contenedor: guardar/desguardar,
  401 sin sesión → redirect a `/entrar`, 404 con evento inexistente, cookie con
  firma inválida tratada como sin sesión.
- ✅ **Zona horaria**: ya estaba resuelta en prod — el Dockerfile fija
  `TZ=America/Monterrey` en la etapa runner y la web en vivo muestra horas
  correctas (5–8 pm). El "2:00 am" se observó solo en el dev server local, que
  corre en UTC; para verlo bien en local: `TZ=America/Monterrey npm run dev`.

## Variables de entorno
Ver `.env.example`. En local, `.env` ya tiene `SESSION_SECRET` y `ADMIN_KEY`
aleatorios generados, `WHATSAPP_TEST_MODE=true`, y las claves de terceros vacías.

## Mapa de archivos clave
- Contrato: `src/lib/events/types.ts` (`NormalizedEvent`)
- Ingesta: `src/lib/ingest/` (jsonld, llm, sources/ticketmaster, page-connector,
  registry, run) + `scripts/ingest.ts`
- Dedupe/upsert: `src/lib/events/{normalize,upsert}.ts`
- Web: `src/app/` (page = Explorar, eventos/[id], entrar, perfil, mis-eventos,
  admin/salud) + `src/app/api/`
- WhatsApp/auth: `src/lib/whatsapp.ts`, `src/lib/auth/{otp,session}.ts`
- Digest/recordatorios: `src/lib/digest/`, `src/lib/reminders/` + `scripts/`
