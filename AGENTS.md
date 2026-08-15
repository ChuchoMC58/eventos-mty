<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Tests: `npm test` NO toca la BD; los que borran van aparte

(Vigente desde 2026-07-27.)

- **`npm test`** → los 19 archivos que no terminan en `.db.test.ts`, sin Postgres.
  Seguro de correr en cualquier momento, incluso con un preview o el dev server
  arriba. (Son 231 al 2026-08-11; el número envejece, la regla no: **lo que separa
  los dos comandos es el sufijo del archivo, no el conteo**.)
- **`npm run test:borra-bd`** → los 6 archivos `*.db.test.ts`. **RESETEAN la BD**,
  pero contra `eventos_mty_test` (el setup `tests/setup-bd.ts` le pega el sufijo
  `_test` a `DATABASE_URL`), nunca contra la de desarrollo.
- **`npm run test:todo`** → los dos; correr antes de pushear.
- `resetDb()` aborta si `DATABASE_URL` no termina en `_test`. Un test nuevo que
  toque la BD **debe** llamarse `*.db.test.ts`.
- ⚠️ **La BD de tests NO se migra sola.** Después de cada `prisma migrate dev`, los
  tests de BD truenan con "column does not exist" hasta que le apliques las
  migraciones también a `eventos_mty_test`:
  `DATABASE_URL="...eventos_mty_test" npx prisma migrate deploy`

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

## ⚠️ El VPS corre en UTC: todo preview miente en las horas

**El host está en `Etc/UTC` y producción en `America/Monterrey`** (`ENV TZ` en el
`Dockerfile`, verificado con `date` dentro del contenedor). `formatFecha` usa la hora
local del proceso, así que **cualquier preview levantado a mano —`next dev` o el build
standalone— pinta las horas seis horas adelantadas**, y las funciones de tarde-noche
saltan al día siguiente: un concierto de las 6:00 pm se ve como "12:00 am" del día
después.

Ya costó un diagnóstico falso el 2026-08-14 ("los eventos están adelantados un día").
**Antes de perseguir un bug de fechas, descartar esto**: levantar el preview con la zona
de producción y volver a mirar.

```bash
setsid env TZ=America/Monterrey PORT=3107 HOSTNAME=127.0.0.1 node .next/standalone/server.js
```

Los datos en la BD están en UTC y son correctos; lo que cambia es cómo se pintan.

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
3. **La INTERACTIVIDAD no se verifica contra `next dev`** (2026-08-10). Un clic
   automatizado sobre un componente cliente puede no hacer nada simplemente
   porque el dev server sigue compilando y React **aún no ha hidratado**: se ve
   idéntico a un botón roto. Para probar interacción, levantar el build de
   producción:

   ```bash
   npm run build
   cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
   set -a; . ./.env; set +a
   PORT=3107 HOSTNAME=127.0.0.1 node .next/standalone/server.js
   ```

   (El standalone NO copia solo `static/` ni `public/`; sin eso sale sin CSS.)
   Si aun así hay que usar el dev server, confirmar que hidrató antes de concluir
   nada: `Object.keys($0).some(k => k.startsWith('__react'))`.

## Screenshots y pruebas de UI: Chrome por CDP

Para cualquier cosa más allá de una foto (hacer clic, escribir, leer estado) se
levanta Chrome con `--remote-debugging-port=9222` y se le habla por CDP desde
Node — **sin dependencias**: Node 22 ya trae `WebSocket` global.

```bash
docker run -d --rm --name cdp --network host --entrypoint chromium-browser \
  zenika/alpine-chrome --no-sandbox --headless=old --disable-gpu \
  --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 about:blank
# tab nuevo: PUT http://127.0.0.1:9222/json/new?about:blank → webSocketDebuggerUrl
```

### Probar flujos con efectos externos SIN dispararlos (2026-08-11)

Para llegar al paso 2 del login (el campo del código) hay que pasar por el paso 1,
que **manda un WhatsApp real**. En vez de gastarlo, se intercepta la petición con
el dominio `Fetch` y se responde un 200 falso:

```js
await send('Fetch.enable', { patterns: [{ urlPattern: '*request-code*', requestStage: 'Request' }] });
// … clic en el botón; llega Fetch.requestPaused con requestId …
await send('Fetch.fulfillRequest', { requestId, responseCode: 200,
  body: Buffer.from('{"ok":true}').toString('base64') });
```

Dos apoyos del mismo flujo:

- **Escribir en un input controlado por React** no funciona con `input.value = x`:
  hay que usar el setter nativo del prototipo y despachar `new Event('input',
  {bubbles:true})`.
- **Páginas con sesión**: firmar la cookie a mano (`userId.hmac` con
  `SESSION_SECRET`, ver `src/lib/auth/session.ts`) e inyectarla con
  `Network.setCookie` antes de `Page.navigate`. Si se crea un usuario de prueba en
  la BD para esto, **borrarlo al terminar** y verificar el conteo.

### Comparar variantes de estilo SIN compilar cada una (2026-08-11)

Para enseñarle al usuario opciones de diseño no hace falta un build por variante:
se inyecta un `<style>` vacío en la página ya cargada, se le cambia el
`textContent` por cada variante y se captura sólo la región de interés con
`Page.captureScreenshot` + `clip` (la caja sale de `getBoundingClientRect`). Siete
variantes en una sola carga, y el repo no se toca hasta que el usuario elige.

Al medir si algo cabe, **medir de verdad** en vez de estimar: sumar los anchos de
los hijos más `columnGap × (n−1)` y compararlo con el ancho del contenedor da los
píxeles exactos que sobran o faltan. Así se supo que los corchetes de las
pestañas se pasaban por 50 px.

⚠️ `deviceScaleFactor: 3` en un viewport de 1280 cuelga la siguiente llamada a
`Runtime.evaluate`. Con 2 no pasa.

Trampas ya pisadas (2026-08-10):

- ⚠️ **Cerrar las pestañas entre corridas.** Cada `json/new` abre una y no se
  cierra sola; con varias abiertas cargando imágenes, `Page.captureScreenshot`
  empieza a colgarse.
- **Si el contenedor deja de responder, RECREARLO, no reiniciarlo.** `docker
  restart cdp` a veces lo deja muerto (es `--rm`) y `docker ps` sale vacío; el
  síntoma es que el script falla al instante sin explicación.
- **Una página con ~70 imágenes externas cuelga a Chrome.** Filtrar la vista
  (`?fecha=finde&categoria=deportes`) para bajar a ~10.
- **Apilar `backdrop-blur` también cuelga la captura de página completa**, y ese
  sí no tiene nada que ver con las imágenes: la cartelera tenía una barra
  pegajosa con desenfoque **por cada día**, y componer esas capas en un viewport
  de 3000 px con `--disable-gpu` deja colgado `Page.getLayoutMetrics` **antes**
  de capturar. Si una página se cuelga y tiene pocas imágenes, buscar
  `backdrop-blur` repetido antes de culpar a la red.
- **`getComputedStyle` MIENTE sobre `outline-color`.** Al verificar el anillo de
  foco devuelve el color del texto aunque la regla lleve un literal con
  `!important`. Se perdió un rato creyendo que `var(--senal)` no resolvía — y sí
  resolvía. **El foco se verifica a ojo**, con un Tab de verdad
  (`Input.dispatchKeyEvent` con `windowsVirtualKeyCode: 9`).
- Poner un **tope por llamada** (`Promise.race` con un `setTimeout`) en el
  cliente CDP: un método colgado sin tope se lleva la corrida entera sin decir
  cuál fue.

## ⚠️ `pkill -f` / `pgrep -f` se matan a sí mismos

`pkill -f 'next dev'` mata el propio `bash -c` que lo ejecuta, porque su línea de
comando **contiene el patrón**. El síntoma es un exit code 143/144 sin más
explicación. Usar `pkill -x <nombre>` (coincidencia exacta del ejecutable) o
buscar el PID por el puerto, que es lo más fiable:

```bash
PID=$(ss -ltnp | grep ':3107' | grep -o 'pid=[0-9]*' | cut -d= -f2); kill "$PID"
```

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
harness, que lo reapea). (d) El túnel sirve igual apuntando al **build de
producción** en vez del dev server (`--url http://localhost:3107`), y es lo que
conviene cuando lo que se enseña tiene interactividad — ver la trampa 3 de arriba.

# Docs de progreso — mantener al día y commitear en `main` local

Para que una sesión nueva no arranque desde cero:

- `HANDOFF.md` — actualizar (fecha de "Última actualización", hecho vs.
  pendiente) y **commitearlo en `main` local** como cualquier archivo; se
  pushea junto con lo demás cuando el usuario dé el OK.
- `README.md` / `DEPLOY-COOLIFY.md` — actualizar solo si el cambio los vuelve
  obsoletos.
<!-- END:nextjs-agent-rules -->
