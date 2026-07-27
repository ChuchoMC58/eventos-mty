# Eventos MTY — Handoff / Estado del proyecto

> Documento de continuidad para retomar el trabajo en una sesión nueva.
> Última actualización: 2026-07-27 (segunda tanda: calendario Android, diálogo Sí/No, tests separados).

## Qué es

Agregador de eventos de Monterrey (música, deportes, cultura) con cartelera web
pública + digest semanal y recordatorios por WhatsApp. Monolito Next.js + Postgres
(Prisma). Todo el texto de usuario en español. Ver `docs/` para el spec y el plan
completos si están presentes.

## Estado: FASE 0–4 COMPLETAS. App DESPLEGADA en Coolify.

- **61 tests pasan** (`npm run test:todo` = 45 puros + 16 de integración),
  **lint limpio** (`npm run lint`) y **build de producción limpio** (`npm run build`).
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
npm test                    # 45 tests puros, SIN BD — seguro con el dev server arriba
npm run test:borra-bd       # 16 tests de integración; RESETEA la BD eventos_mty_test
npm run test:todo           # los dos (correr antes de pushear)
npm run dev                 # http://localhost:3000
npm run build               # build de producción
npm run ingest|digest|reminders   # jobs CLI
```

### Tests: dos comandos, dos bases (desde 2026-07-27)
Antes había un solo `npm test` que **borraba la BD de desarrollo** en cada corrida
(los tests de integración llaman `resetDb()`, que necesita la base vacía para poder
afirmar conteos). Ese día se perdieron así los eventos locales. Ahora:

- **`npm test`** → solo los archivos `tests/*.test.ts` que NO tocan Postgres (45).
  No borra nada; se puede correr con un preview o el dev server arriba.
- **`npm run test:borra-bd`** → solo `tests/*.db.test.ts` (16), con
  `vitest.bd.config.ts`. Su setup (`tests/setup-bd.ts`) reescribe `DATABASE_URL`
  agregándole el sufijo `_test` **antes** de que Prisma se instancie, así que
  siempre acaba en `eventos_mty_test` aunque el `.env` apunte a `eventos_mty`.
- **Candado en `resetDb()`** (`tests/helpers/db.ts`): si `DATABASE_URL` no termina
  en `_test`, tira error en vez de borrar. Cubre el caso de un test nuevo que use
  `resetDb()` pero no se llame `*.db.test.ts` — ese entraría en `npm test` y le
  caería encima a la BD de desarrollo. La convención de nombres es una promesa;
  el candado es la verificación.
- La BD de tests es desechable: `dropdb eventos_mty_test` y se recrea con
  `createdb -h 127.0.0.1 -U postgres eventos_mty_test` +
  `DATABASE_URL="…/eventos_mty_test" npx prisma migrate deploy`.

Un test nuevo que toque la BD debe nombrarse `*.db.test.ts`.

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
  `false` antes de eso. ⚠️ ANTES de apagarlo: arreglar el formato `+521` (ver abajo).
- **⚠️ FORMATO `+521` CONFIRMADO COMO BUG (2026-07-25):** la app guarda los teléfonos
  como `+52` + 10 dígitos, SIN el `1` que WhatsApp-MX usa. Se probó en sandbox
  mandando a ambos formatos al número del usuario: a `+529223736016` (sin `1`) →
  **falló, err 63015** (WhatsApp lo trata como número distinto no unido); a
  `+5219223736016` (con `1`) → err 63016 (sólo ventana, número reconocido). ⇒ el
  formato sin `1` NO entrega. **Decisión del usuario: NO arreglar aún; hacerlo al
  integrar el sender de producción de Meta.** Fix propuesto: helper en `sendWhatsApp`
  que inserte el `1` para móviles MX al enviar, sin tocar el almacenamiento canónico
  `+52` (que sirve al dedup). Ver [[whatsapp-mx-521-format]] y `src/lib/auth/phone.ts`.
- **⚠️ Ventana de 24 h del Sandbox (entendido 2026-07-27):** el Sandbox de WhatsApp
  sólo entrega mensajes de texto libre (OTP, recordatorios) **dentro de las 24 h**
  posteriores a que el usuario le escriba al número del sandbox (+1 415 523 8886).
  Fuera de esa ventana rebotan con err 63016. Por eso "no llega el código" a ratos:
  la ventana se cerró → el usuario debe mandar cualquier mensaje (ej. `hola`) al
  sandbox para reabrirla. Esto NO es viable en producción: un usuario real nunca
  tiene ventana abierta → **en prod el OTP DEBE ir como plantilla de autenticación
  aprobada de Meta**, no como texto libre. Es el mismo pendiente grande de Meta.
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
  scheduler de Coolify dispara solo (ejecución de prueba `success`).
  **Conector de Arena SANO (verificado 2026-07-25):** el "404" era una caída
  transitoria de la API de Arena (`api.arenamonterrey.com`) el 22 y 23-jul temprano,
  NO un bug del código. Se recuperó solo el 23-jul 16:06 UTC y desde entonces ingiere
  **47 eventos** consistentemente, incluida la corrida del cron del 24-jul 12:00 UTC
  (ver tabla `SourceRun` en prod). El endpoint responde 200 y el parseo sigue cuadrando.
  El de Citibanamex se eliminó (TM cubre ese venue). La ingesta diaria vive de
  Ticketmaster + Arena.
- **Expansión nacional (futuro):** el conector de Ticketmaster está fijo a
  `city=Monterrey`. Para abrir otras ciudades habrá que parametrizarlo por ciudad y
  añadir `ciudad`/región a la navegación.
- **Dominio real** (opcional): hoy usa un dominio auto `*.sslip.io`. Para links de
  WhatsApp conviene un dominio propio apuntando a la IP del VPS.

**Pendiente (código — siguiente sesión):**
- Refinamiento visual fino del rediseño (el usuario quiere funcionalidad primero,
  pulir al final).
- **BUG: `reminderSentAt` se marca aunque el WhatsApp rebote** (`src/lib/reminders/run.ts`):
  `client.messages.create()` de Twilio devuelve `queued` sin lanzar excepción, y el
  rebote real (p.ej. 63016 fuera de ventana) ocurre después, async. Como el código
  hace `reminderSentAt = now()` justo tras el `create`, un recordatorio que rebotó
  queda marcado como enviado y **nunca se reintenta** → el usuario lo pierde en
  silencio. Aplica también en prod ante cualquier rebote transitorio. Atacar junto
  con la integración de Meta (idealmente: sólo marcar como enviado tras confirmar
  entrega, o reintentar si el status final no es delivered).

**Resuelto (2026-07-27, segunda tanda):**
- ✅ **"Google Calendar" abre la APP en Android — vía `VIEW` + `package`, no
  `ACTION_INSERT`.** El enfoque anterior (`intent://` con
  `action=android.intent.action.INSERT`) **nunca podía funcionar**: Chrome solo
  lanza actividades que declaran `android.intent.category.BROWSABLE`
  (https://developer.chrome.com/docs/android/intents) y la pantalla de "nuevo
  evento" de Google Calendar no la declara → el intent no resolvía y SIEMPRE caía
  al `browser_fallback_url`, o sea al navegador. Ese era el bug reportado.
  Lo que sí funciona (elegido por el usuario probando 8 variantes en su Android
  real, con una página de laboratorio temporal ya borrada): envolver el MISMO link
  web de Google en un intent `VIEW` con `package=com.google.android.calendar`, así
  el deep link de `calendar.google.com` lo abre la app en vez de Chrome. Se le
  agregó `S.browser_fallback_url` (el lab no lo traía) para el Android sin la app
  instalada. **Pendiente:** confirmar el botón real en device; en el lab la
  variante ya se validó. iOS/desktop no cambian (siguen con el link web); en
  iPhone la ruta de un toque es el `.ics`, verificado con Apple Calendar
  mostrando título, sede, fecha y la alerta de 2 h.
  **Descartado y documentado en el código:** en iOS no hay equivalente — el scheme
  `comgooglecalendar://` no está documentado ni acepta parámetros de evento.
- ✅ **Diálogo propio "¿Te recordamos por WhatsApp?" con botones Sí / No**
  (`SaveButton`): antes usaba `window.confirm`, que rotula "OK/Cancel" en el idioma
  del navegador y no se puede cambiar. Igual que antes, **ambos botones guardan el
  evento** (la pregunta es solo por el recordatorio) y el subtítulo lo aclara; Esc
  y clic afuera equivalen a "No", para no perder el clic en "Me interesa".
- ✅ **Sesión huérfana = sin sesión** (`getSessionUserId`): la cookie está firmada
  con HMAC, pero la firma puede ser válida y el usuario ya no existir en la BD
  (cuenta borrada, BD reseteada). Antes la app se veía "con sesión" y cada escritura
  tronaba con `Foreign key constraint violated: SavedEvent_userId_fkey`. Ahora se
  verifica que el usuario exista (consulta por PK) y si no, se trata como no-sesión
  → redirige a `/entrar`.
- ✅ **`SaveButton` ya no miente al fallar:** solo marca "★ Guardado" si el servidor
  respondió OK; si no, deja el botón como estaba y muestra el error en rojo. Antes
  cualquier 500 se veía como guardado exitoso y el evento desaparecía al recargar.
- ✅ **Tests separados en dos comandos y dos bases** — ver "Comandos de trabajo".
- ✅ **Lint limpio:** `GoogleCalendarButton` hacía `setState` dentro de `useEffect`
  (error `react-hooks/set-state-in-effect` que venía del commit `c2d32cc`); ahora
  detecta Android con `useSyncExternalStore`, sin mismatch de hidratación.

**Resuelto (2026-07-27):**
- ✅ **Botón de calendario "Apple/Outlook (.ics)" → "Apple Calendar"** (commit
  `7ce9aa3`, `main` local sin push): el nuevo Outlook (Windows) NO abre el `.ics`
  directo a guardar (Microsoft lo confirma como esperado; hay que importar a mano),
  así que "Outlook" prometía un clic que no pasa. Se dejó sólo "Apple Calendar" —el
  caso que sí funciona limpio (iPhone/Mac abren Calendar de un toque)—. **Nota:** en
  desktop Windows el `.ics` seguirá abriendo Outlook porque es la app por defecto del
  SO para `.ics`, no algo que controle el botón. Verificado en iPhone real (BrowserStack):
  el `.ics` abre Apple Calendar con el evento y la alerta de 2 h (`VALARM`) presente.
- ✅ **Hora del `.ics` NO es bug (aclarado):** el `.ics` guarda la hora en UTC
  (`DTSTART:...Z`). En el iPhone de BrowserStack se veía "03:00" porque ese emulador
  está en zona UTC; en un teléfono real en Monterrey se ve 9:00 PM correcto (el
  contenedor de prod ya corre `TZ=America/Monterrey`). Los calendarios SIEMPRE muestran
  en la zona del dispositivo — no se puede "forzar" que siempre diga 9 PM. Mejora
  opcional de baja prioridad: usar `TZID=America/Monterrey` (no cambia lo que se ve
  en un device en otra zona, sólo hace la intención explícita y ayuda con DST).
- ❌ **[SUPERADO — ver "segunda tanda" arriba] Botón "Google Calendar" vía
  `intent://` con `ACTION_INSERT`** (commit `c2d32cc`): este enfoque resultó
  imposible en Chrome (requisito de `BROWSABLE`) y fue reemplazado por el intent
  `VIEW` + `package`. Se conserva la nota por el contexto que sigue siendo válido:
  nuevo `androidCalendarIntentUrl` en `src/lib/calendar.ts` + componente
  cliente `src/components/GoogleCalendarButton.tsx` que detecta Android (por
  userAgent, tras montar, sin mismatch de hidratación) y cambia el href al `intent://`
  (`ACTION_INSERT` de evento, con `browser_fallback_url` al link web). En iPhone/desktop
  sigue el link web `TEMPLATE` de siempre. **Contexto:** el link web de Google
  (`calendar.google.com/render?action=TEMPLATE`) abre el navegador aunque tengas la
  app instalada —es diseño de Google, no bug—; el `intent://` es la vía para abrir la
  app nativa en Android. **Gotcha ya corregido:** el `intent://` debe navegar en la
  MISMA pestaña (Chrome bloquea el launch de apps desde `target="_blank"` → caía al
  fallback web). **Salvedad:** `intent://` depende del navegador (Chrome/Samsung sí,
  Opera flojo, Firefox parcial); el fallback web es el piso confiable que siempre
  funciona. Última prueba del usuario quedó en: tras el fix de la pestaña, revalidar
  en Chrome/Opera si ya abre la app.
- ⚠️ **Previews: `next dev` NO sobrevive al túnel — usar build de producción.** Se
  levantó el preview con `node .next/standalone/server.js` (output `standalone`) en
  el puerto 3105 contra la BD de prod (IP `172.16.1.7`) + `cloudflared`. Recordar
  copiar `.next/static` y `public` dentro de `.next/standalone/` tras cada build.

**Resuelto (2026-07-24):**
- ✅ **OTP no falla en silencio si el WhatsApp rebota** (commit `b494dbd`, `main`
  local sin push): `request-code` no capturaba la excepción de `sendWhatsApp` → un
  fallo de envío (proveedor caído, tope de mensajes, número inalcanzable) devolvía
  un 500 sin JSON y `EntrarForm` reventaba al hacer `res.json()` → el botón se
  rehabilitaba sin mostrar error. Ahora la ruta responde **503 con mensaje claro en
  español** y el form parsea el JSON a prueba de fallos en ambos pasos. Verificado
  contra el fallo real de Twilio (429 `63038`): antes HTTP 500 crudo, ahora 503 +
  mensaje; el path de número inválido sigue en 400.
- ✅ **Horas verificadas correctas en prod (cierre del "2:00 am"):** el contenedor
  corre con `TZ=America/Monterrey` y la web renderiza p.ej. Ricardo Montaner como
  "mar 28 jul · 9:00 pm" (guardado 03:00 UTC). El "2 am" era solo del dev server
  (UTC). No hay nada que arreglar; para ver bien en local: `TZ=America/Monterrey npm run dev`.
- ✅ **SaveButton confirmado operativo en prod:** ya estaba montado en
  `eventos/[id]` (el hallazgo de "no está en ninguna página" era pre-rediseño y
  quedó obsoleto). Verificado end-to-end: botón "☆ Me interesa" renderiza, `/api/saved`
  da 401 sin sesión, y con login real (OTP) se guarda un evento con recordatorio y
  aparece en `/mis-eventos`. **Login probado 100% real (2026-07-24):** tras el
  Upgrade de Twilio a cuenta **Full** (tope de 5/día levantado), el OTP viajó de
  verdad por WhatsApp, el usuario lo leyó y se completó verificar→sesión→guardar→
  recordatorio→Mis eventos sin nada simulado. Ver [[whatsapp-mx-521-format]].
- ✅ **Cuenta Twilio Upgraded a Full (2026-07-24):** ya no es Trial → sin el tope
  diario de 5 mensajes (error `63038`). Saldo pagado agregado ($20; puede tardar
  minutos en reflejarse tras el pago). Sigue siendo **Sandbox** para WhatsApp
  (entrega solo a números con `join`); el sender aprobado + plantillas de Meta
  sigue pendiente para mandar a terceros. `WHATSAPP_TEST_MODE=true` intacto.
- ✅ **Previews vía Cloudflare Tunnel documentados** (commit `eb9dd31`): `cloudflared`
  ya estaba instalado (`~/.local/bin`) pero sin documentar. Flujo en `AGENTS.md`
  (§ "Exponer un preview"). El firewall de Hostinger bloquea puertos directos y
  el ruteo contenedor→host, así que el túnel es la vía simple. Se agregó
  `*.trycloudflare.com` a `allowedDevOrigins`. **Ojo:** `next dev` (HMR) NO
  sobrevive al túnel (error "Connection closed" + reload en loop) → para un preview
  compartible usar **build de producción** (`node .next/standalone/server.js`), no
  `next dev`.
- ✅ **Desplegado a prod (push 2026-07-24):** este lote (fix de OTP `b494dbd` +
  config/docs) se pusheó a `main` con OK del usuario → auto-deploy de Coolify. El
  único cambio funcional en prod es el fix de OTP; `next.config` (allowedDevOrigins)
  es solo dev.

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
