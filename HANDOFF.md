# Eventos MTY — Handoff / Estado del proyecto

> Documento de continuidad para retomar el trabajo en una sesión nueva.
> Última actualización: 2026-08-08 (**el cron del digest de vuelta a las 18:00** —estaba
> en una hora de prueba desde el 2-ago— y **arreglado un bug de recordatorios: el
> reintento de un mensaje rebotado era imposible** y su test pasaba por llamar dos veces
> con el mismo reloj. Además, **los 7 eventos huérfanos, borrados** — y de paso se
> desmintió el doc que los llamaba "de origen desconocido": estaban **sólo en dev** (prod
> tenía 0) y son residuo de eventos **reprogramados**, porque el dedupe empata por
> mismo-venue+mismo-día y una fecha nueva crea fila nueva. Ver "Sesión 2026-08-08").
> Antes, 2026-08-07 (**séptima fuente: Fever**, ~56 eventos de 34 planes,
> con **solape cero por construcción** —11 venues que ninguna otra fuente toca— y la
> primera fuente que no es boletera de conciertos: Candlelight, museos, experiencias
> inmersivas y juegos callejeros. El reconocimiento del mismo día decía que las fechas
> por función estaban en el renderizado Angular: **estaban en la página de cada plan**,
> en un `astro-tools-transfer-state` que además trae ciudad, sede con dirección y precio.
> Ver "Sesión 2026-08-07 (tarde)". Commits locales, **sin pushear**).
> Antes, el mismo día (**sexta fuente: AREMA Ticket**, ~143 eventos de NL
> con **cero** solape con las otras fuentes, y con ella se **cierra la lista de fuentes
> sin explorar**: Pabellón M ya entraba por Ticketmaster con su nombre nuevo y el Teatro
> de la Ciudad ya entraba por CONARTE. Boletia queda descartado y Fever quedaba viable
> pero sin implementar — eso último ya no vale: se implementó esa tarde, ver arriba.
> Ver "Sesión 2026-08-07". Commits locales, **sin pushear**).
> Antes, 2026-08-06 (**quinta fuente: Superboletos**, ~88 eventos de NL
> de los que ~37 son netos nuevos; de paso **tacha Showcenter Complex** de la lista de
> pendientes. Y se corrigió un dato falso de `FUENTES.md`: decía que Luma "corre a
> diario en prod" y **no**, `origin/main` sigue con dos conectores. Ver "Sesión
> 2026-08-06 (tarde)". Commits locales, **sin pushear**. Quedaron **2 duplicados** entre
> Arena y Superboletos y **7 eventos huérfanos** sin fuente: ver "Lo que quedó ABIERTO").
> Antes, el mismo día: **CONARTE traía 12 eventos, no 5**: dos bugs de
> parseo se comían más de la mitad de la fuente, y el número del doc de
> reconocimiento estaba mal porque se midió con el mismo parseo roto. Ver "Sesión
> 2026-08-06". Antes, el 2026-08-05: **5 categorías: `tecnologia` y `bienestar`** —el
> plan de categorías ya es código y Luma pasó de 4 a **16 eventos**. Ver
> "Sesión 2026-08-05 (tarde)". Commits locales, **sin pushear**). Antes, el mismo
> día: **dos conectores nuevos, CONARTE y Luma** —los
> reportes de reconocimiento de CONARTE y Luma (hoy fundidos en `FUENTES.md`) ya son
> código: 9 eventos nuevos ingeridos en la BD dev, ninguno de los cuales existe en
> Ticketmaster. Ver "Sesión 2026-08-05". Commit local, **sin pushear**). Antes,
> 2026-08-03 (**primer envío por plantilla real de todo el
> proyecto**: recordatorio y digest salieron con `contentSid` desde el sender de
> producción y llegaron bien —ver "Sesión 2026-08-03"—. De paso se desmintió que el
> digest ya se hubiera probado así: lo del 2-ago fue texto libre desde el sandbox, y ahí
> quedó **cómo distinguirlos en el log de Twilio**. Además, **la baja ya acepta las
> variantes que la gente escribe** (`Baja.`, `darme de baja`, `BAJA por favor`) —commit
> `a6177b0`, sin pushear—, que hacía falta porque la plantilla del digest dice "Responde
> BAJA". Sigue el ⛔ del OTP. Antes, 2026-08-02: **flujo completo probado end-to-end en local** —login, digest, recordatorio, baja y reactivación, todo verde contra la BD **dev**; ver "Sesión 2026-08-01/02", que incluye la regla de qué recursos se usan en local y **estado efímero que hay que revertir**: el webhook del sandbox quedó apuntando a un túnel—. Antes, 2026-07-31: **plantillas de recordatorio y digest APROBADAS por Meta** —el recordatorio quedó UTILITY—; **el login ya se puede probar en local** con el fallback de texto libre en modo prueba; webhook del sender repuntado a `vibramx.fun` tras descubrir que llevaba 2.5 días apuntando a un dev server; plantillas de respaldo borradas; **el sitio ya se llama `Vibra MX`**, no "Eventos MTY"; **intento de verificación del negocio PAUSADO** por el régimen fiscal del RFC. **Nada está pusheado** y sigue el ⛔ por el OTP — ver "Sesión 2026-07-29" abajo para el trámite).

## ⛔ LO PRIMERO: el push está bloqueado — deployar tumba el login en producción

(Vigente desde 2026-07-29. **Borrar esta sección cuando se destrabe.**)

El código exige plantilla aprobada para todo mensaje que inicia el negocio,
**incluido el OTP del login** — y la plantilla de OTP **no existe**: está atada a la
verificación del negocio en Meta, pausada por el régimen fiscal del RFC. Si esto se
deploya, `plantillaOtp()` lanza `Falta TWILIO_CONTENT_SID_OTP` y **nadie puede
entrar**. Es intencional: es preferible a un login que aparenta funcionar.

⚠️ El fallback de texto libre **NO destraba esto**: está atado a
`WHATSAPP_TEST_MODE=true` a propósito. Sirve para probar en local, no para deployar.

Antes de pushear tienen que estar las cuatro:

1. ✅ Recordatorio y digest aprobados por Meta (2026-07-31).
2. 🔴 **Que exista la plantilla de OTP** (o sea: verificación del negocio lista).
   Es el único bloqueo real.
3. Variables en Coolify: `TWILIO_CONTENT_SID_OTP`,
   `TWILIO_CONTENT_SID_RECORDATORIO=HXdfa8086a05d711d7feaf5d52ce6d9e4b`,
   `TWILIO_CONTENT_SID_DIGEST=HX626b23de0d02f571a3a841967d6667b9`,
   `TWILIO_WHATSAPP_FROM=+17347670241`.
   ⚠️ Los SIDs viejos (`HX97332f…`, `HX93686b…`) eran de plantillas de respaldo **ya
   borradas**: configurarlos daría un 404 de Twilio en cada envío.
4. `WHATSAPP_TEST_MODE=false` **hasta el final**, y sólo con todo lo anterior listo.

El detalle del trámite y por qué se pausó están en las sesiones del 2026-07-29 al
08-03, más abajo.

## Qué es

Agregador de eventos de Monterrey (música, deportes, cultura) con cartelera web
pública + digest semanal y recordatorios por WhatsApp. Monolito Next.js + Postgres
(Prisma). Todo el texto de usuario en español. Ver `docs/` para el spec y el plan
completos si están presentes.

## Estado: FASE 0–4 COMPLETAS. App DESPLEGADA en Coolify.

- **213 tests puros pasan** (`npm test`) + **35 de BD** (`npm run test:borra-bd`, ver
  más abajo). **Lint limpio** (`npm run lint`).
  ⚠️ **`tsc --noEmit` NO está limpio: 5 errores**, todos en `tests/fever.test.ts` y
  todos del commit `16b7159` (2026-08-07). Son de tipado del fixture de `fetch`
  (`Record<string, string>` contra un objeto de claves literales), no afectan a los
  tests —pasan— ni al build de producción. Medido el 2026-08-08. Sin arreglar.
- Commits por fase (rama `main`, ya en GitHub `ChuchoMC58/eventos-mty`, público):
  - `fase 0` scaffold + esquema BD
  - `fase 1` ingesta (conectores, dedupe, salud de fuentes)
  - `fase 2` cartelera web (explorar, detalle, calendario)
  - `fase 3` usuarios, digest y recordatorios por WhatsApp
  - `fase 4` despliegue en Coolify (VPS Hostinger). **App en vivo:**
    https://vibramx.fun (+ `www.`). El `*.sslip.io` se retiró el 2026-07-28.
- **Despliegue:** Coolify en el propio VPS. Postgres gestionado por Coolify
  (separado de la BD dev local). Auto-deploy activo: `git push` a `main` →
  webhook de GitHub → Coolify reconstruye y redespliega. HTTPS (Let's Encrypt).
- Prod tiene **82 eventos reales** de Ticketmaster (ingesta corrida 2026-07-22);
  los 6 eventos demo del `prisma db seed` ya fueron borrados. BD prod ≠ BD local.
- Auto-deploy verificado end-to-end: `git push` a `main` → webhook de GitHub →
  Coolify reconstruye y cambia el contenedor (~2–3 min medidos).
- **Rediseño UI "Marquesina" en producción (2026-07-21):** cartelera nocturna —
  tokens Tailwind v4 (tinta/hueso/humo + categorías ámbar/verde/lila, más cian y
  coral desde que son 5 — ver `globals.css`), fuente
  display Archivo Black, home con agenda agrupada por día (Hoy/Mañana), filtros
  como chips, CTA de WhatsApp en el hero, y todas las páginas/formularios con el
  mismo lenguaje visual. Se eligió entre 2 prototipos, que vivían sin trackear en
  `design/` y **se borraron el 2026-08-06** (ya no aportaban: el diseño elegido
  lleva semanas en producción). `formatPrecio` ahora usa separador de miles.

## Sesión 2026-08-08 — los 7 huérfanos borrados, y no eran lo que el doc decía

### El doc se equivocaba en las dos cosas que importaban

`HANDOFF.md` los describía como de **origen desconocido** y decía que "aparecen en la
cartelera como cualquier otro". Las dos falsas, y bastó una consulta a cada BD:

- **Prod tenía 0 huérfanos.** Los 7 existían **sólo en la BD dev**, así que nunca
  estuvieron en la cartelera pública. (`SELECT … LEFT JOIN "EventSource" … IS NULL`
  contra el contenedor de prod: 0 de 141 eventos.)
- **El origen no era un misterio: son eventos reprogramados.** 4 de los 7 tienen hoy un
  gemelo vivo y con fuente en otra fecha — Kapo (8-ago huérfano → 5-nov con
  `ticketmaster`), Lavoe Sinfónico (3-ago → 27-mar-2027), Ricardo Montaner (29-jul →
  19-nov) y Camilo (`CAMILO 2026` 5-sep → `CAMILO 2027` 7-mar). El dedupe de
  `upsertEvents` sólo empata **mismo venue + mismo día**, así que al moverse la fecha se
  crea una fila nueva y la vieja se queda sin nadie que la refresque.
- De los 3 restantes, 2 ya eran pasado (CA7RIEL 1-ago, Los Alegres 2-ago) y 1 era futuro
  sin reemplazo (Tativerso Chicharrín, 30-ago).

### Qué se borró

Los 7, en una transacción contra la BD **dev**. Quedan 400 eventos y **0 huérfanos**.
En cascada se fue **1 `SavedEvent`**: el del recordatorio de prueba del 2026-08-02
(Lavoe Sinfónico, número de test del admin, evento ya pasado).

### Lo que quedó ABIERTO

1. 🟡 **La ingesta nunca da de baja lo que desaparece de su fuente.** No hay limpieza:
   un evento que la fuente deja de publicar se queda en la BD para siempre. Hoy no duele
   —los eventos con fuente ligada están todos frescos, 0 con `lastSeenAt` de más de 7
   días— pero es el mecanismo que fabricó estos 7 y los volverá a fabricar.
2. 🟡 **`runDigest` elige a quién mandarle con `now.getDay()`**, que usa la zona del
   proceso. A las 18:00 de Monterrey en UTC **ya es el día siguiente**, así que si ese
   contenedor dejara de estar en `America/Monterrey` todos recibirían su digest un día
   antes del que eligieron. Hoy no pasa sólo por `ENV TZ=America/Monterrey`
   (`Dockerfile:26`). Propuesto calcular el día con zona explícita; **el usuario lo dejó
   fuera** de este lote a propósito.
3. Los 5 errores de `tsc` en `tests/fever.test.ts` (ver "Estado", arriba).

### El cron del digest, corregido — y por qué la hora no era el hueco

`25 4 * * *` (22:25 de Monterrey) era una hora de prueba del 2026-08-02 que se quedó
puesta. **Ya está en `0 0 * * *` = 18:00 MTY**, la intención original, aplicado por API y
verificado. Las tres tareas quedan: ingesta 06:00, recordatorios 10:00, digest 18:00.

Dos cosas que se verificaron para poder afirmar eso, porque de ellas depende:

- **El contenedor de Coolify corre en UTC**, así que las expresiones cron se interpretan
  en UTC (`docker exec coolify date`).
- **El de la app corre en `America/Monterrey`** (`Dockerfile:26`, confirmado en vivo).

Y **prod no tiene crons aparte**: hay 1 sola aplicación en Coolify, 0 servicios y ningún
crontab en el host. Esas tres tareas son las únicas del sistema.

### Bug arreglado: el reintento del recordatorio era imposible

`src/lib/reminders/run.ts` prometía en un comentario que un mensaje rebotado deja
`reminderSentAt` en null "para que siga siendo elegible para el próximo run". **No podía
pasar nunca**: la ventana era `[mañana 00:00, pasado 00:00)`, así que si el envío rebotaba
el día D para un evento de D+1, la corrida de D+1 ya buscaba en `[D+2, D+3)` y el evento
quedaba fuera para siempre.

Importa por el caso que el propio test simula: **63016 = "fuera de la ventana de 24 h"**,
el rebote más probable en WhatsApp. Se perdía el recordatorio en silencio.

- **El test no lo detectaba porque llamaba a `runReminders` dos veces con el mismo
  `now`**, cosa que un cron diario jamás hace. Ahora avanza el reloj 24 h; con el código
  viejo, esa segunda corrida manda **0**.
- **El arreglo**: la ventana arranca en `now` en vez de "mañana 00:00", así que el evento
  sigue siendo alcanzable mientras no haya empezado. Se mantiene `reminderSentAt: null`
  como única guarda contra duplicados. Dos tests nuevos: el evento de hoy que aún no
  empieza (y que el texto diga "hoy") y el que ya empezó, que no debe enviarse.

---

## Sesión 2026-08-07 (tarde) — séptima fuente: Fever, la primera que no es boletera

Se implementó lo que la sesión de la mañana había dejado documentado a propósito. La ficha
completa está en `FUENTES.md` ("Fever — `fever`"); aquí lo que no se ve en el código.

### El reconocimiento de la mañana estaba incompleto, y por eso el conector salió mejor

La ficha decía que las fechas por función sólo existían en el renderizado Angular
(`/es/monterrey/<categoria>`, 28 sesiones en `/candlelight`) y que la ciudad había que
adivinarla por el nombre de la sede. Las dos cosas eran falsas, y salieron al abrir la
página de **un plan** (`/m/<id>`) en vez de la home:

- `<script id="astro-tools-transfer-state" type="application/json">` trae **JSON limpio**
  —sin las tuplas `[0, valor]` de Astro y sin entidades— con `planDetail` (ciudad, sede
  **con dirección**, categorías, descripción, precio) y el árbol del selector de boletos
  con **las funciones reales**.
- O sea: la etapa 2 sale de la misma página en la que ya estábamos, y el renderizado
  Angular no hace falta para nada.

Moraleja repetida (regla 8): el reconocimiento se había hecho sobre la home. Bastó abrir
un plan para que la mitad de las trampas dejaran de serlo.

### Números

- **49 planes en la home → 34 publicables → 56 eventos.** Se van 13 por `isTimeless`
  (tarjetas de regalo con fecha `2030-01-01` incluidas) y 2 por ser de otra ciudad.
- **Solape cero, y esta vez por construcción**: sus 56 eventos caen en 11 venues (Museo de
  Historia Mexicana, Saxy Jazz, Teatro Versalles, Papalote, Macroplaza…) y ninguna otra
  fuente tiene **un solo evento** en ninguno. Se verificó por venue y mirando la lista
  completa de venues de la BD a ojo, no con `sameEventTitle` (reglas 5 y 7).
- Corrida completa: 1 + 36 peticiones en tandas de 4, ~40 s.

### Tres decisiones que no son obvias

1. **Un plan de temporada se publica UNA vez, no un día por renglón.** Los museos, las
   exposiciones y los juegos callejeros se venden con un calendario de días disponibles
   (hasta 55). Publicarlos todos sería repetir el mismo título 55 veces en la cartelera;
   se publica el próximo día disponible y, como la ingesta corre a diario, la fecha se
   recorre sola.
2. **Lo mismo aplica a un plan que corre a diario aunque Fever no lo marque como
   calendario.** Salió del dry-run: el "City Tour Hop On/Hop Off" publicaba 10 renglones
   idénticos. Más de 6 días distintos ⇒ se trata como corrida continua. Los Candlelight,
   que sí queremos expandir, no pasan de 3 fechas.
3. **`nightlife` es música, no fiesta**: es la etiqueta con la que Fever clasifica varios
   Candlelight. Y `mix` es su cajón de sastre, así que va a `cultura`, que es el nuestro.

### Lo que quedó ABIERTO en esta sesión

1. 🔴 **Los términos de uso de Fever: SIN REVISAR**, como los de Luma, Superboletos y
   AREMA. Su `robots.txt` sí permite las dos rutas que se usan.
2. 🟡 Las funciones que se publican son **las que la página precarga**, no la temporada
   completa de cada plan. Alcanza de sobra para el horizonte de 10 días del digest; si
   algún día hiciera falta más, el hilo es el endpoint detrás de `getPlanSessionsForPlace`.
3. Sigue abierto todo lo de las sesiones anteriores (el duplicado del Mitote y los 2 de
   Arena/Superboletos). Los 7 eventos huérfanos ya **no**: borrados el 2026-08-08.

---

## Sesión 2026-08-07 — sexta fuente: AREMA, y se acabó la lista de fuentes sin explorar

### Lo que se investigó y lo que salió

El punto de partida era la lista de "fuentes sin explorar" (Auditorio Pabellón M y Teatro
de la Ciudad) más tres boleteras que agrega la competencia (Boletia, Arema, Fever). De
cinco candidatos, **dos ya estaban cubiertos, uno se implementó, uno queda viable y uno
está cerrado**:

| Candidato | Veredicto |
|---|---|
| **Auditorio Pabellón M** | Ya entraba. Es el **`Escenario GNP Seguros`** de Ticketmaster (43 eventos en prod); se reconoció por la dirección, Av. Benito Juárez 1002. Su sitio propio está muerto (redirige a `/lander`) |
| **Teatro de la Ciudad** | Ya entraba. Lo administra CONARTE: 6 de los 19 eventos que trae ese conector son suyos. Lo de paga entra por Arema y TM |
| **AREMA Ticket** | ✅ Implementado, `arema` |
| **Fever** | Reconocida a fondo y **no implementada ese momento** —decisión del usuario: documentarla en vez de escribirla—. Se implementó **esa misma tarde**: ver la sesión de arriba |
| **Boletia** | ❌ Cerrado. Su CloudFront da 403 a todo, incluso a `robots.txt`, y también desde fuera de este VPS: bloquean clientes no-navegador |

### AREMA (`arema`)

Sexta fuente. Detalle completo —los dos endpoints, las trampas y sus defensas— en
`FUENTES.md`. Lo esencial:

- **No es scraping.** Dos endpoints JSON sin auth, encontrados en su bundle de React.
  `events/list` con `{}` devuelve el catálogo **nacional entero en una petición** (648
  eventos, 96 en NL).
- **~143 eventos vigentes en NL** y **cero se fusionaron con otra fuente**: son venues que
  literalmente nadie más nos daba — Auditorio Río 70 (24), Dramático (14), Café Iguana,
  Jardín 85, los Zagar Comedy Bar. Es la primera fuente con **masa de comedia**.
- **Cierra la lista de fuentes sin explorar**: ya no queda ninguna.

Tres decisiones que no son obvias y conviene no "arreglar":

1. **Hay una segunda etapa por evento, y es necesaria.** El listado trae **una sola fecha**
   por evento —la primera función— aunque la obra tenga temporada; "Gran Feria Nuevo León"
   tiene 10. Los 96 del listado se vuelven ~143 funciones. Son 96 peticiones extra en
   tandas de 4; la corrida completa tarda 3.8 s.
2. **Su API responde HTTP 200 aunque falle** (`{"error":true,"code":"UNXEND"}`). Mirar sólo
   el status apagaría la fuente en silencio. `post()` mira el cuerpo.
3. **Lo desconocido cae en `cultura`, no en `musica`** — al revés que Superboletos, porque
   aquí la música sí tiene etiqueta propia (`Concierto`) y sin ambigüedad.

Y una cuarta que es puro dedupe: **`Pabellon M` → `Escenario GNP Seguros`** y **`Teatro de
la Ciudad de Monterrey` → `Teatro de la Ciudad`**, por nombre exacto. Con regex o
"parecido", `Teatro de la Ciudad San Nicolás` —otro teatro, otro municipio— se fusionaría
con el del centro.

### Fever, que ese momento no se implementó

No se escribió el conector **a propósito**: el usuario pidió documentar en vez de seguir.
Lo hecho aquí fue el reconocimiento. **Se implementó esa misma tarde** — ver la sesión
"2026-08-07 (tarde)" arriba, que además corrige dos cosas que este reconocimiento dio por
buenas: las fechas por función NO están sólo en el renderizado Angular, y la ciudad no hay
que adivinarla por el nombre de la sede.

### Lo que quedó ABIERTO en esta sesión

1. 🟡 **Un duplicado nuevo, del mismo bug de siempre**: el `34 Mitote Folklórico` aparece
   3× los días 8 y 9 de agosto en Teatro de la Ciudad (1 de Arema + 2 de CONARTE, que
   entre sí **no** son duplicados: son Gran Sala y Escenario al Aire Libre). Es otra vez
   `sameEventTitle` comparando por substring. Se va solo cuando acabe el festival, y no se
   tocó `normalize.ts` **a propósito**: es un cambio global a los 6 conectores y requiere
   OK. Tabla en `FUENTES.md`, sección "Duplicados conocidos entre fuentes".
2. 🔴 **Los términos de uso de AREMA: SIN REVISAR**, como los de Luma y Superboletos.
3. Sigue todo lo abierto de la sesión anterior (los 2 duplicados Arena/Superboletos y los
   7 eventos huérfanos).

---

## Sesión 2026-08-06 (tarde) — quinta fuente: Superboletos, y un dato falso en los docs

### El dato falso, primero

`FUENTES.md` afirmaba que la API interna de Luma *"corre a diario en prod"*, y **es
mentira**. `origin/main` sólo tiene `ticketmaster` y `arena-monterrey` en el registry;
`src/lib/ingest/sources/luma.ts` **no existe ahí**. `main` local va **37 commits
adelante** sin pushear, así que CONARTE, Luma y ahora Superboletos están escritos y
testeados pero **el cron de producción sigue ingiriendo con dos fuentes**.

Se descubrió porque el dato se usó como argumento ("ya hay algo sin revisar corriendo en
prod") y el usuario lo cuestionó. Tercera vez que un dato de los docs se repite como
hecho y resulta falso — ver también `HANDOFF.md` sobre el conteo de commits de `fab2f0d`.
**Verificar contra git/la BD antes de citar los docs**, sobre todo lo que afirme algo
sobre producción.

**Pendiente con nombre propio: desplegar los tres conectores.** Son ~28 eventos de
CONARTE y Luma más ~37 de Superboletos que hoy no le llegan a nadie.

### Superboletos (`superboletos`)

Quinta fuente. Detalle completo —endpoint, las 10 trampas y sus defensas— en `FUENTES.md`.
Lo esencial:

- **No es scraping.** Su front Next.js lee un solo JSON en CloudFront con el catálogo
  nacional (1,159 eventos). 3 peticiones fijas, cero por evento.
- **88 vigentes en NL**, de los que 51 son de Arena Monterrey (ya cubiertos) → **~37
  netos nuevos**: Showcenter Complex (21), Dion Live Center (9), Café Iguana y otros.
- **Tacha Showcenter Complex** de las fuentes sin explorar. Quedan dos: Auditorio
  Pabellón M y Teatro de la Ciudad.

Tres decisiones que no son obvias y conviene no "arreglar":

1. **Un precio `0` NO es gratis aquí.** Los 88 traen `0` y significa "no sé", al revés que
   en CONARTE. Copiarlo pintaría toda la cartelera como entrada libre.
2. **`claveTipoEvento` no sirve como señal de categoría.** "Familiares" es un cajón de
   marketing: los 12 son conciertos (Melanie Martinez, Morat, Elefante). Manda
   `claveGenero`.
3. **Los rangos de fecha se descartan.** Sin año son ambiguos y **sí contienen eventos
   pasados** — `THE BOOK OF MORMON` "Del Jue. 21 al Dom. 24 Mayo" era de mayo de 2026 y ya
   había ocurrido. Se pierden ~13 de 97; mejor eso que publicar un evento que ya pasó.

También: `fechaZonaAUtc()` salió de `sources/conarte.ts` a **`src/lib/ingest/fechas.ts`**
para compartirlo (CONARTE lo re-exporta, sus tests siguen igual). Y se aclaró que
`minExpected` **no es un piso de la corrida actual** sino un gate sobre la anterior, así
que para una fuente de ~88 eventos el default basta; el piso real es una aserción dentro
del conector, que es lo único que ve un colapso parcial (88 → 3), invisible para
`hayCaida()`.

### Facebook / Instagram: descartados

Investigado y cerrado, con la razón en `FUENTES.md`: el Event API de Facebook es sólo para
Facebook Marketing Partners (partnership comercial, no app review) e Instagram no tiene
concepto de evento. Eventbrite tampoco: cerró su búsqueda pública en 2019.

### Lo que quedó ABIERTO en esta sesión

Todo esto salió **después** del commit `2bc5712` y no está arreglado:

1. 🔴 **Dos eventos duplicados** entre `arena-monterrey` y `superboletos`:
   `HARLEM GLOBETROTTERS 2026` / `…MONTERREY 2026`, y `SIN BANDERA: ESCENAS TOUR` /
   `SIN BANDERA DIC 2026`. Los dos a la misma hora exacta. La causa es que
   `sameEventTitle` compara por substring y no aguanta una palabra metida en medio.
   Tabla completa, los casos que **no** hay que fusionar y por qué la solución obvia
   rompe cosas: `FUENTES.md`, sección "Duplicados conocidos entre fuentes".
   **No se tocó `normalize.ts` a propósito**: es un cambio global a los 5 conectores y
   requiere OK.
   - Cómo se encontró: listando a ojo los pares mismo-venue/mismo-día. **Contarlos con
     `sameEventTitle` da 0 por construcción** — la misma trampa que con CONARTE.
2. ~~**7 eventos huérfanos, sin ninguna fuente ligada** (`sources: none`), creados el
   22–23 de julio~~ ✅ **BORRADOS el 2026-08-08.** Ver "Sesión 2026-08-08" arriba: eran
   sólo de la BD **dev** (prod tenía **0**), y no había que investigar su origen porque
   4 de los 7 tenían ya un reemplazo vivo y con fuente en otra fecha.
3. **Ticketmaster duplica solo, desde antes**: `5 Seconds of Summer` vs
   `5SOS - BITE THE APPLE UPGRADE`; `Dale Mixx 2026` partido en cuatro variantes de
   boleto. Nada que ver con Superboletos.
4. **ToS de Superboletos y de Luma: sin leer.** Los dos.

## Sesión 2026-08-06 — CONARTE traía 12, no 5: dos bugs de parseo (commit `05d1cc5`)

Salió de una pregunta del usuario —"¿sólo son 5 eventos de CONARTE?"— que resultó
ser la pregunta correcta. **Son 12 en la misma ventana de 21 días**; el conector
tiraba 7 en silencio.

1. **El sitio envuelve el HTML por ancho**, así que las etiquetas salen partidas en
   dos líneas según dónde caiga el corte: `<var\nclass="atc_date_start">`. Los
   patrones buscaban el espacio literal, así que en esas páginas `parseDetalle`
   devolvía **cero** eventos. Afectaba a fecha, sede, disciplina, descripción y
   precio a la vez. Ahora todos los `class=` aceptan cualquier espacio en blanco.
2. **La etiqueta es `agenda • Disciplina`, pero a veces `agenda • Disciplina •
   Ciclo`**, y el código tomaba el **último** segmento. Con un ciclo de por medio
   leía el nombre del ciclo como disciplina — y como de ahí sale
   `DISCIPLINA_MUSICAL`, **un concierto dentro de un festival habría caído en
   `cultura`**. Se toma el segundo, que es donde vive siempre.

**Por qué pasó callado tanto tiempo:** había defensa para "ningún detalle
respondió" (todos HTTP != 200), pero no para "respondió 200 y no pude leer nada".
Ahora un detalle mudo se avisa por `console.warn` y, si **todos** lo son, revienta.

⚠️ **El reporte de reconocimiento de CONARTE tenía el volumen mal por esto mismo**: los "5 eventos en
21 días" del reconocimiento se midieron con el parseo que tenía el bug, o sea que
**la medición heredó el bug**. Ya está corregido en ese doc. Moraleja para el
próximo reconocimiento: un conteo bajo puede ser la fuente… o el parser.

Fixture nuevo (`conarte-detalle-envuelto.html`) con la página real que fallaba.
131 tests puros en verde. Ingesta real: `conarte: 12`, `luma: 17`.

## Sesión 2026-08-05 (tarde) — 5 categorías y Luma completo (commits locales, SIN PUSHEAR)

El plan de categorías pasó a código: commits `011b750` (refactor puro) y `8a81f32`
(feature). **Luma pasa de 4 a 16 eventos** — 6 tecnología, 6 bienestar, 3 música,
1 cultura — en ingesta real contra la **BD dev**, corrida dos veces sin duplicados.
Nada de esto lo vende una boletera.

### Lo primero fue tirar la hipótesis más cara del plan

El plan abría con "Ticketmaster puede estar escondiendo más inventario que Luma
entera, mídelo antes de invertir". Medido con la llave de prod: **2 de 89**, ambos
`Miscellaneous`, y uno ni siquiera es un evento (un meet & greet que se vende
aparte). Cero cambios a la taxonomía. Lo que quedó vivo del hallazgo es que ese
descarte **ya no es mudo**: `ticketmaster.ts` avisa con el conteo por segmento.

Dato suelto que salió de ahí y nadie había mirado: esa consulta trae **0 eventos
de Sports**. Rayados y Sultanes no entran por `city=Monterrey`.

### Las decisiones que eran del usuario

1. **"Todo" sigue siendo todo** — los cinco chips en la misma fila.
2. El chip se llama **"Tecnología"**.
3. **Sin aviso** en la cartelera: las categorías nuevas nacen desmarcadas y se
   descubren entrando a `/perfil`. ⚠️ Implica que **nadie las recibe en el digest
   hasta que entre y las marque**.

### Cómo quedó el conector de Luma

De 1 consulta a 9: las 8 categorías **más el feed sin filtro**. Como el listado no
dice a qué categoría pertenece cada evento, la categoría sale de *a qué endpoint se
preguntó* — y un evento responde en varias, así que hay dedupe por `api_id` y una
prioridad explícita (`musica > cultura > bienestar > tecnologia`); sin ella la
categoría dependía del orden de los `for`.

| Decisión | Por qué |
|---|---|
| La heurística de música corre **sólo** dentro de Arts & Culture y en lo que no trae categoría | "showcase" es palabra de concierto y de startups: suelta, un demo day se volvía concierto |
| Climate → `tecnologia`, Food & Drink → `cultura`, **pero el conector avisa** la primera vez que traigan algo | Su destino se decidió con una muestra del feed global, sin un solo caso de Monterrey |
| El corte por Nuevo León quedó **global**, no por consulta (el plan pedía por consulta) | Las coordenadas se ignoran para todas por igual; per-consulta, una categoría chica con un evento de Saltillo tumbaba la ingesta entera |
| El tope de páginas sí es **por consulta** | Una categoría atorada no debe comerse el presupuesto de las otras ocho |

### Dos cosas que sólo salieron al verificar contra datos reales

- **El club de correr caía en `cultura` por descarte.** Era exactamente el criterio
  nº 2 de verificación del plan, y falló en la primera corrida: `OWWR's Taylor
  Swift-Themed Run` es el único evento que Luma no clasifica en ninguna categoría.
  Se agregó `ES_BIENESTAR`, que corre **sólo** en el fallback.
- 🔴 **`upsertEvents` no actualiza `category`** (`src/lib/events/upsert.ts`): sólo
  la escribe al **crear**. Un evento ya guardado conserva su categoría aunque el
  conector aprenda a clasificarlo mejor — se vio en vivo con ese mismo club de
  correr, que siguió en `cultura` hasta borrar la fila y reingerirla. **No se
  cambió**: afecta a todos los conectores y abre el caso de dos fuentes que cubren
  el mismo evento (Ticketmaster y Arena lo hacen) pisándose la categoría en cada
  corrida. En prod no muerde ahora, porque estos eventos se van a crear de cero.

### Verificación

`npm test` → **129 puros** en verde; `tsc --noEmit` y `lint` limpios. Ingesta real
dos veces contra la BD dev. Revisado en la app (dev server + túnel) que los chips
nuevos salen con su color: se confirmó en el CSS servido que Tailwind v4 **sí
generó** `.text-tecnologia` y `.bg-bienestar/15` — era la trampa que marcaba el
plan.

⚠️ **Al levantar el dev server para revisar, va con `TZ=America/Monterrey`**, o las
horas salen en UTC y parece un bug ("meetup a la 1:00 am"). El contenedor de prod
ya tiene ese `TZ` puesto; verificado.

### Lo que NO hizo falta (verificado, no supuesto)

Migración de Prisma (`Event.category` es `String`), plantilla nueva de Meta (el
cuerpo aprobado del digest no nombra categorías), ni tocar la validación del API
(`z.enum(CATEGORIES)` se extiende sola).

## Sesión 2026-08-05 — dos fuentes nuevas: CONARTE y Luma (commit local, SIN PUSHEAR)

Los dos reportes de reconocimiento de CONARTE y Luma (hoy en `FUENTES.md`) pasaron a
código. Aportan **9 eventos** que **ninguna boletera tiene**: 5 culturales de CONARTE
(4 de entrada libre) y 4 de venue chico de Luma (Casa Dam, Victoria Records, Las Dunas
Record Café, Maquiladora Pueblo Nuevo). Poco volumen, sí, pero es inventario
diferenciado: Ticketmaster no puede traer lo que nadie vende.

Archivos: `src/lib/ingest/sources/{conarte,luma}.ts`, registrados en `registry.ts`,
con `tests/{conarte,luma}.test.ts` (puros, sin BD) y sus fixtures.

### Lo que se verificó antes de escribir código

Los dos docs se comprobaron contra el sitio real en vez de creerles: CONARTE sigue
dando **5 eventos en 21 días** y Luma **19 en el área metropolitana, 5 en Arts &
Culture**. Dos cosas del doc de Luma resultaron **desactualizadas**:

> 🔴 **El "5" de CONARTE era falso, y esta "verificación" no lo detectó** (visto el
> 2026-08-06: son **12**). Es el caso más útil de todo el proyecto sobre cómo se
> verifica mal: comprobar el número **con el mismo parseo que lo produjo** no
> comprueba nada — si el parser tiene un punto ciego, la verificación tiene el mismo
> punto ciego y devuelve "confirmado". Lo que sí lo destapó fue mirar el HTML crudo
> del sitio y contar los `<a href>` a mano, sin pasar por el conector. Regla:
> **para verificar un conteo, cuenta por un camino distinto al del código que lo
> generó.**

- El listado **ya trae sede y precio** (`geo_address_info`, `ticket_info`). El doc decía
  que sólo estaban en el detalle. El conector hace **una sola petición**, no ~20.
- El filtro por categoría sirve: `discover_category_api_id=cat-AzVAf6VmE9JEre4` baja de
  19 a 5. Así se ingiere sólo Arts & Culture (opción (a) del doc) sin tocar `CATEGORIES`.

### Las trampas de los docs, y dónde quedó cada defensa

| Trampa | Defensa en el código |
|---|---|
| CONARTE: fecha *timezone-naive* que se corre 6 h | `fechaZonaAUtc()` usa `Intl` con la zona del evento; el test corre el mismo caso bajo `TZ=UTC`, `America/Monterrey` y `Asia/Tokyo` |
| CONARTE: `<li>` señuelo en días vacíos | `parseListado()` descarta `no-events` |
| CONARTE: `/agenda?fecha=` es 301 con cuerpo vacío | la URL se escribe con diagonal, y hay test |
| CONARTE: sede poco confiable en el listado | se lee del detalle (`p.subtitle`), cortada en el separador ` I ` |
| Luma: geolocaliza por IP (el VPS aterriza en Boston) | `latitude`/`longitude` siempre + **revienta** si nada es de Nuevo León |
| Luma: `pagination_cursor` (no `next_cursor`) | paginación con el nombre correcto, tope de 20 páginas y corte si el cursor no avanza |
| Luma: sede oculta en ~22% (`mode: obfuscated`) | esos eventos se **descartan**: sin nombre real colapsarían en un `Venue` falso y el dedupe fusionaría eventos sin relación |

### El umbral de alerta ya no es global — `Connector.minExpected`

`dropAlert` exigía que la corrida previa hubiera traído **≥ 5** eventos. CONARTE y Luma
rondan justo ese número, así que una caída a cero **no habría alertado nunca**. Ahora
cada conector puede fijar su umbral (`minExpected: 2` en los dos nuevos) y el criterio
vive en `hayCaida()` (`src/lib/ingest/connector.ts`), que usan tanto `runIngest()` como
`/admin/salud` — antes la página repetía el `>= 5` por su cuenta.

Además, cero eventos no siempre es lo mismo que "no sé leer la página": el conector de
CONARTE **lanza error** si ningún día del barrido tuvo la forma esperada (ni resultados
ni el aviso de día vacío). Eso es lo que convierte un cambio de tema del sitio en un
fallo ruidoso en vez de una fuente que se apaga en silencio.

### `priceMin: 0` ya se muestra como "Gratis"

Las dos fuentes traen entrada libre como `0` (que es un dato real, distinto de
`undefined` = "no sé"). `formatPrecio(0)` decía `"desde $0"`, y **los dos call sites de
la web trataban el 0 como ausente** (`e.priceMin ? … : null`). Arreglado: la cartelera y
el detalle dicen "Gratis", y el botón "Boletos" dice "Más info" cuando el evento es
gratuito — no hay boletos que comprar.

### Verificación

`npm test` → **121 puros** pasando; `tsc --noEmit` y `lint` limpios. Ingesta real contra
la **BD dev** (`npm run ingest`): `conarte: 5`, `luma: 4`, sin duplicados al correrla dos
veces y sin colisiones de `Venue`. Revisado en la app (dev server + túnel) que los
eventos salen con imagen, "Gratis" y descripción.

Notas del entorno, no del código: en el `.env` local `TICKETMASTER_API_KEY` está
**vacía**, así que esa fuente sale `✗` en local (en prod está configurada en Coolify);
y la BD dev tiene una fila basura en `Source` con slug `s`, de antes de esta sesión.

### Pendientes que deja

- ~~Categorías nuevas (plan aparte)~~ **HECHO el mismo día**, ver "Sesión
  2026-08-05 (tarde)" arriba. (Aquí decía además que Ticketmaster podía estar
  escondiendo mucho inventario por segmento: **se midió y era falso**, 2 de 89.)
- **Términos de uso de Luma: SIN REVISAR** (el doc ya lo marcaba). Es una API interna,
  no documentada; conviene leerlos antes de que esto corra a diario en prod.
- Una sede de CONARTE (~1 de cada 5) no publica recinto y cae en el `Venue`
  "CONARTE (sede por confirmar)". Se prefirió eso a tirar el 20% del inventario.
- Fuentes con más volumen sin explorar: Auditorio Pabellón M, Showcenter Complex,
  Teatro de la Ciudad, Superboletos. *(Al 2026-08-06 quedan sólo Pabellón M y Teatro de
  la Ciudad: el conector de Superboletos cubrió también Showcenter.)*

## Sesión 2026-08-03 — las plantillas SÍ se probaron (antes no), y la baja tolerante

### ✅ Recordatorio y digest enviados por plantilla real, con el sender de producción

Primer envío del proyecto con `contentSid`. Los dos llegaron y se marcaron `read`:

| plantilla | SID del mensaje | ContentSid |
|---|---|---|
| recordatorio | `MMedb3db41bdf9829e70d51397a7b6358f` | `HXdfa8086a05d711d7feaf5d52ce6d9e4b` |
| digest | `MM85a1dc6e238af46a1bc78aa0e9d8e337` | `HX626b23de0d02f571a3a841967d6667b9` |

Se corrieron los jobs de verdad (`scripts/reminders.ts`, `scripts/digest.ts`) contra la
BD dev, no un script suelto que llamara a `plantilla*()` a mano — el riesgo del orden de
parámetros vive en el **call site**, así que reescribirlo en la prueba lo habría tapado.
Env del envío: sender `+17347670241`, los dos ContentSid, `ADMIN_WHATSAPP=+5219223736016`
(⚠️ el del `.env` es un número falso, `+528100000000`, hay que sobreescribirlo),
`WHATSAPP_TEST_MODE=true` y `TZ=America/Monterrey`.

Verificado que los `{{n}}` cayeron en su lugar: título, `formatCuando`, sede y el id en
la URL del botón. La sede que llegó ("Escenario GNP Seguros") se contrastó contra la BD
porque coincidía con la del otro evento guardado — no era un cruce de variables.

### 🔴 Lo que se creía probado y no lo estaba

Se dio por hecho que **el digest ya se había probado como plantilla** el 2-ago. Era
falso: esa noche salió por **texto libre** desde el **sandbox**. Se confundieron porque
`textoPrueba` es una transcripción a mano del cuerpo aprobado, así que en el teléfono se
ve idéntico — misma redacción, mismos datos.

**Cómo distinguirlos sin discutir capturas** (los tres son del log de Twilio, no del
teléfono):

1. **El prefijo del SID:** `MM…` = mensaje de contenido (plantilla), `SM…` = texto libre.
2. **El sender:** las plantillas viven en la WABA del `+17347670241`. Lo que salga del
   sandbox `+14155238886` no puede ser plantilla — ahí no existen.
3. **La liga:** el digest del 2-ago traía `http://localhost:3000` y un
   `*.trycloudflare.com`. El cuerpo aprobado está congelado en Meta desde el 31-jul y
   sólo tiene dos huecos (cuenta y ciudad): una URL efímera no cabe ahí. La puso
   `baseUrl()` al armar `textoPrueba`.

Lo que aquella prueba sí validó fue el copy, los datos y `formatCuando`. Lo que no tocó
en absoluto fue Meta.

### Dos cosas que salieron de leer los cuerpos aprobados

- **El botón del recordatorio apunta a `https://vibramx.fun/eventos/{{4}}`**, fijo a
  producción. Con un id de la BD dev ese botón da 404. Implicación permanente:
  **probar recordatorios en local nunca podrá validar la liga** — el id tiene que
  existir en prod.
- **El digest dice "Responde BAJA para dejar de recibir este resumen".** Es el opt-out
  que Meta exige, y hasta hoy el webhook no lo aguantaba bien (ver abajo).

### ✅ La baja ahora acepta lo que la gente escribe — commit `a6177b0`, SIN PUSHEAR

El webhook comparaba `body === "baja"` exacto (sobre el texto ya en minúsculas y sin
espacios). Con la plantilla pidiendo "Responde **BAJA**", eso funcionaba de milagro: por
el `.toLowerCase()`, no por diseño. Todo lo demás —`Baja.`, `darme de baja`,
`BAJA por favor`— caía en el `<Response/>` vacío, y **un opt-out que no responde es justo
lo que Meta no acepta** en plantillas de marketing.

`esBaja()` (`src/lib/whatsapp.ts`) normaliza —sin acentos, sin puntuación ni emoji,
minúsculas, espacios colapsados—, recorta saludos y cortesías alrededor, y compara
contra una lista de frases.

⚠️ **La comparación es del mensaje COMPLETO, no por substring, y es a propósito:**
`"no quiero darme de baja"` contiene `"darme de baja"` entero y significa lo contrario.
Un `includes()` daría de baja a quien dijo que no. Hay un test dedicado a ese caso
(`tests/baja.test.ts`), junto con `bajaron los boletos?` y `la banda tocó bajísimo`.

Entra: `baja` en cualquier caja, `Baja.`, `¡BAJA!`, `bája`, `baja 👍`, `darme de baja`,
`dame de baja`, `me doy de baja`, `quiero darme de baja`, `BAJA por favor`,
`hola baja porfa`, `cancelar`, `cancelar suscripción`, `stop`, `unsubscribe`.

Probado contra la ruta real con el dev server (no sólo el matcher): `BAJA por favor` →
graba `optOutAt` y confirma; `no quiero darme de baja` y `a qué hora es el evento` →
`<Response/>` vacío y `optOutAt` intacto. **106 tests** (73 puros + 33 de BD), lint y
`tsc` limpios.

**Sigue pendiente de esto:** el round-trip real desde el WhatsApp del usuario. Pide
apuntar el webhook del sender de producción a un túnel, que es la maniobra que la vez
pasada quedó 2.5 días sin revertir — se dejó a decisión del usuario.

### Estado efímero de ESTA sesión — ya revertido

Nada quedó sucio: el evento `cmrwgcwt2000xqw3ekga3n3cj` volvió a su fecha
(`2026-08-06 03:00`), el `digestDay` del usuario a 6, y se limpió el `reminderSentAt`
para que el recordatorio siga siendo elegible.

**Se mató un `next-server` del 2-ago** (PID 1704714, día y medio corriendo) que era el
residuo de la sesión pasada — el que recibía los webhooks por el túnel. Salió a la luz
solo: **Next 16 no deja levantar un segundo dev server en el mismo directorio**, así que
si `next dev` se queja de "Another next dev server is already running", hay un residuo.
El proceso del puerto 3000 **no** es de este proyecto (es un bridge del agente).

## Sesión 2026-08-01/02 — prueba end-to-end del flujo completo en local

Se probó el ciclo entero (login OTP → perfil → digest → recordatorio → baja →
reactivación) contra **recursos de desarrollo**, no de producción. Todo pasó.

### ⚠️ REGLA: en local se prueba contra la BD DEV, nunca contra la de prod

La primera vuelta de esta sesión se hizo por error contra la BD de **producción**
(apuntando `DATABASE_URL` a la IP del contenedor `t8h92n0ojfm4dpzsizghl93q`). De ahí
salieron dos horas de conclusiones equivocadas —ver "Lo que costó" abajo—. La
configuración correcta:

| recurso | en local se usa | NO se usa |
|---|---|---|
| Base de datos | `eventos_mty` del Postgres del **host** (`127.0.0.1:5432`), ya migrada | la del contenedor de Coolify |
| Código | el checkout local vía `next dev` / `tsx` | la imagen desplegada |
| Jobs (digest, recordatorios) | disparados **a mano** con `tsx scripts/*.ts` | los scheduled tasks de Coolify |
| `BASE_URL` | la URL del túnel | `https://vibramx.fun` |

**El `.env` del repo ya está bien configurado para esto** (`DATABASE_URL` apunta al
Postgres del host). No hay que tocarlo: basta con NO sobrescribir `DATABASE_URL` al
levantar el dev server. Lo único que hay que inyectar aparte son las credenciales de
Twilio, que no están en el `.env`.

Dos trampas al correr los jobs en local:

1. **`TZ=America/Monterrey` es obligatorio.** El host está en **UTC** y el contenedor
   de prod en `America/Monterrey`. `runDigest` compara `digestDay` contra
   `now.getDay()`, así que sin la TZ el host calcula **domingo** donde prod calcula
   **sábado**, y el digest no empata con nadie.
2. **`BASE_URL` local es `http://localhost:3000`**, así que la liga del WhatsApp no
   abre nada desde el teléfono. Para probar hay que apuntarla al túnel. (En prod la
   variable sí está bien: `https://vibramx.fun`.)

**Twilio sí es compartido** — no existe una cuenta de dev aparte. Lo que protege es
`WHATSAPP_TEST_MODE=true`, que manda **todo** a `ADMIN_WHATSAPP` sin importar el
destinatario real. No apagarlo mientras se prueba en local.

### Lo que se probó (todo ✅, con el código local)

- **Login OTP completo:** `request-code` → `verify` → sesión → `/api/me`, `/perfil`,
  `/mis-eventos`. Guardar y quitar evento (`POST`/`DELETE /api/saved`).
- **Digest:** llega con el formato nuevo (gancho con contador + liga, sin lista
  inline y sin el prefijo `[PRUEBA →]`), `status=read` en Twilio.
- **Recordatorio:** llega con título, `formatCuando` ("mañana a las 8:00 pm") y venue.
  Marcó `reminderSentAt` **sólo tras** `confirmarEntrega` (`reminderStatus=read`),
  que es el comportamiento diseñado — un `create()` sin excepción no basta.
- **Baja por WhatsApp:** `optOutAt` se pone y **`digestDay` se conserva** (6). La
  segunda baja responde "Ya estabas dado de baja" en vez de mandar a buscar una
  cuenta inexistente. Un mensaje que no es "baja" devuelve `<Response/>` vacío.
- **El digest respeta la baja:** `0 enviados` en los tres contadores, y ni siquiera
  imprime las líneas de `[PRUEBA]` — sale por el `return` temprano de
  `users.length === 0`, porque `optOutAt: null` va en el `where`.
- **Reactivación desde `/perfil`:** `optOutAt` vuelve a `NULL` **sin tener que
  recapturar el día**. Ésa es justo la mejora de `4d97873` sobre la versión vieja.

### Lo que costó probar contra prod por error

- **Login roto con 500.** A la BD de prod le faltaba `User.optOutAt`: la migración
  `20260729010916_opt_out_whatsapp` nunca se aplicó porque vive en los commits sin
  pushear. **Ya se aplicó** con `prisma migrate deploy` (columna nullable, aditiva;
  prod corría código que ni la menciona, así que no le afectó).
- **Un digest que parecía validar el formato nuevo y era el viejo.** Llegó con
  `[PRUEBA → +52…]` y la lista de eventos dentro del mensaje: las dos cosas que
  `424641e` quitó. Ver abajo por qué.

### Por qué los crons SIEMPRE corren código viejo

Los scheduled tasks de Coolify hacen `docker exec` **dentro del contenedor de
producción**, y ese contenedor es la imagen del último push (`5d6dd59`, 2026-07-28).
El preview local no los ejecuta: son procesos distintos que sólo comparten la BD si
uno la apunta a la de prod. Lo mismo con el webhook de WhatsApp — Twilio entrega en
la URL registrada del sender, que apunta a `vibramx.fun`, no al túnel.

Consecuencia práctica: **el digest, los recordatorios y la baja no se pueden probar
"desde el preview" sin más**. O se disparan a mano en local, o se reapunta el webhook.

### Los tres crons corren 6 h antes de lo que parece

Coolify evalúa las expresiones cron en **UTC** (`instance_settings.instance_timezone`
= `UTC`, y su contenedor también). El comando corre dentro del contenedor de la app,
que tiene `TZ=America/Monterrey`, así que `now.getDay()` sí da el día local correcto —
pero la hora del cron no es la que aparenta:

| task | cron (UTC) | hora real en Monterrey |
|---|---|---|
| `ingesta` | `0 12 * * *` | 06:00 |
| `recordatorios` | `0 16 * * *` | 10:00 |
| `digest` | `0 0 * * *` | **18:00**, no medianoche |

Funciona bien, pero por acomodo de dos zonas horarias, no porque el cron diga lo que
hace. Si alguien "corrige" el digest a `0 6 * * *` pensando en medianoche, lo rompe.

### ⚠️ Estado efímero de esta sesión — REVERTIR

1. **Webhook del sandbox apuntado al túnel.** El sender `XEfa539e8303cb08c337a9bfbdab02ab0b`
   (`whatsapp:+14155238886`) quedó en una URL `*.trycloudflare.com`. **Mientras siga
   así, la baja de `vibramx.fun` no funciona**, y cuando el túnel muera Twilio no
   recibirá respuesta. Regresarlo:
   ```
   POST https://messaging.twilio.com/v2/Channels/Senders/XEfa539e8303cb08c337a9bfbdab02ab0b
   {"webhook":{"callback_url":"https://vibramx.fun/api/whatsapp/webhook","callback_method":"POST"}}
   ```
   (Ojo: el sandbox y el número de producción son **senders distintos**. El de prod es
   `XE4508db748ef8a40888bb3982835a01af` / `whatsapp:+17347670241`.)
2. ~~**Cron del digest en Coolify** quedó en `25 4 * * *` para las pruebas; el original
   es `0 0 * * *`.~~ ✅ **REVERTIDO el 2026-08-08** — ver "Sesión 2026-08-08".
3. **Datos de prueba en la BD local:** un evento movido al día siguiente y un
   `SavedEvent` con recordatorio, creados a mano para disparar el recordatorio.

Lo que **NO** hay que revertir: la migración `optOutAt` aplicada a la BD de prod.

> **Verificado el 2026-08-03: los puntos 1 y 2 SIGUEN SIN REVERTIR.** El webhook del
> sandbox apunta a `https://dirt-beach-compact-charges.trycloudflare.com/api/whatsapp/webhook`
> (túnel muerto) y el cron del digest sigue en `25 4 * * *` — o sea, corriendo a las
> **22:25 de Monterrey** en vez de las 18:00. El sandbox aparece `OFFLINE`, así que su
> webhook ya no hace daño; el cron sí está vivo. El punto 3 sí se limpió.
>
> **Al 2026-08-08: el punto 2 ya está revertido** (`0 0 * * *` = 18:00 MTY). El punto 1
> sigue sin revertir, y sigue sin hacer daño mientras el sandbox esté `OFFLINE`.

### Sigue pendiente

`TWILIO_CONTENT_SID_OTP` / `_RECORDATORIO` / `_DIGEST` no están cargadas en Coolify,
así que **todo mensaje sigue saliendo como texto libre**, que sólo se entrega dentro
de la ventana de 24 h. Nada de lo probado hoy valida las plantillas aprobadas de Meta.
Y la membresía del sandbox expira a las ~72 h: si empieza a rebotar con **63015**, hay
que remandar `join though-excellent` al +1 415 523 8886.

> **Al 2026-08-03:** las plantillas de recordatorio y digest **ya se probaron** con
> `contentSid` y el sender de producción (ver la sesión de arriba). Lo de las env vars
> de Coolify sigue vigente: prod no las tiene y por eso sigue mandando texto libre.

## Sesión 2026-07-29 — salida del Sandbox y plantillas

**⛔ LO PRIMERO: hay 34 commits locales SIN PUSHEAR, y NO se deben pushear todavía.**
El código ya exige plantillas para todo mensaje que inicia el negocio, incluido el
OTP — y la plantilla de OTP **no existe**. Si esto se deploya, `plantillaOtp()` lanza
`Falta TWILIO_CONTENT_SID_OTP` y **el login se cae en producción**. La lista de lo
que tiene que pasar antes está al inicio de este documento (§ "LO PRIMERO").

**No confíes en esta lista: cuéntalos.** `git log origin/main..HEAD --oneline`. Esta
nota ya estuvo mal dos veces (decía 4 cuando eran 10, y 6 cuando eran 12) porque se
fue actualizando a mano sumando los commits nuevos, sin contrastar contra `origin/main`.
El último push a `main` fue `5d6dd59`; todo lo posterior está sin subir.

Los que traen cambios de código (el resto son docs): `424641e` (plantillas + `+521`),
`4d97873` (baja total), `32a5013` (recordatorio UTILITY + `formatCuando`),
`bc32cb2` (digest con cuenta pluralizada y ciudad dinámica).

### Lo que se logró

- ✅ **Sender de producción registrado y `ONLINE`:** `whatsapp:+17347670241`, display
  name `Vibra MX`, límite `250 Customers/24hr`. **Se salió del Sandbox.**
- ✅ **El código migró a plantillas:** `sendWhatsApp` → `sendPlantilla` con
  `contentSid` + `contentVariables`.
- ✅ **`+521` de salida arreglado** (`mxWhatsAppNumber` en `src/lib/auth/phone.ts`).
- ✅ **Baja total:** `User.optOutAt` apaga digest **y** recordatorios, y la app lo
  anuncia. **Probado con el WhatsApp real del usuario** contra un túnel: "baja" →
  `optOutAt` grabado y `digestDay` intacto; repetir "baja" no movió la fecha y
  respondió "Ya estabas dado de baja" en vez de mandarlo a buscar una cuenta.
  (Funciona sin plantillas porque el usuario escribe primero: la respuesta cae
  dentro de la ventana de 24 h, donde el texto libre sí se permite.)
- ✅ **Plantillas de recordatorio y digest APROBADAS por Meta (2026-07-31).** Tardaron
  ~1.5 días desde el envío del 29, sin aviso intermedio (el estado sólo salta de
  `pending` a `approved`). El recordatorio **quedó UTILITY**: Meta respetó la categoría
  y no la recategorizó, así que los recordatorios salen a la tarifa más barata.
  **SIDs buenos:** recordatorio `HXdfa8086a05d711d7feaf5d52ce6d9e4b`,
  digest `HX626b23de0d02f571a3a841967d6667b9`. Los dos respaldos ya se **borraron**
  (2026-07-31): tenían los bugs de copy viejos.
- 🔴 **Plantilla de OTP BLOQUEADA** hasta que se verifique el negocio. **Esto es lo
  único que sigue deteniendo el deploy** — las otras dos ya no.
- ✅ **Recordatorio rehecho como UTILITY con la fecha en variable**
  (`HXdfa8086a05d711d7feaf5d52ce6d9e4b`). Ver más abajo para el
  cuerpo y el porqué de la categoría. Lo que toca al código: nuevo `formatCuando`
  (`src/lib/format.ts`) que devuelve "hoy a las 9:00 pm" / "mañana a las 9:00 pm" /
  "el jue 30 jul a las 9:00 pm", **comparando días de calendario, no horas**. Así el
  "Mañana es …" deja de estar congelado en el cuerpo aprobado y la plantilla sobrevive
  al cambio de ventana a 12–36 h sin volver a pasar por revisión de Meta.
  ⚠️ **`plantillaRecordatorio` cambió el ORDEN de sus parámetros** (ahora título,
  cuándo, sede, id) para seguir a las variables de la plantilla nueva. Los cuatro son
  `string`: cruzarlos compila y sólo se ve en el WhatsApp del usuario.

- ✅ **Digest rehecho** (`HX626b23de0d02f571a3a841967d6667b9`): el cuerpo
  viejo traía tres datos congelados que en realidad varían — `eventos` en plural fijo
  (decía **"hay 1 eventos"** con una sola coincidencia), `Monterrey` fijo (contra la
  expansión nacional) y "Esta semana" cuando el horizonte son 10 días. Ahora `{{1}}` es
  la cuenta **con su sustantivo** y `{{2}}` la ciudad desde `User.city` vía
  `nombreCiudad`. `runDigest` dejó de filtrar por `city: "monterrey"`: consulta las
  ciudades que tienen usuarios ese día y cada quien cuenta la suya.
  ⚠️ **`plantillaDigest` ahora recibe `(cuantos, ciudad)`.**

**La regla que dejaron las dos plantillas:** un cuerpo aprobado por Meta **no se
edita** — corregirlo cuesta plantilla nueva y otra revisión. Todo lo que dependa de los
datos (fecha relativa, plural, ciudad, sede) tiene que viajar en una variable, aunque
hoy parezca constante. Y ojo con la concordancia: un verbo que se refiera a la cuenta
("que **van** con tus gustos") se rompe igual que el plural del sustantivo.

**Aclaración importante (2026-07-29):** la verificación del negocio **sólo bloquea las
plantillas AUTHENTICATION** (el OTP). Las de MARKETING y UTILITY —recordatorio y
digest— pasan por el review normal de Meta y no dependen de ella. Antes esto estaba
mezclado en las notas como si un solo bloqueo detuviera todo.

### 🔴 El bloqueo real: verificación del negocio

> 📌 **Datos con los que se dio de alta el sender** (rescatados de
> `META-WHATSAPP.md` al borrarlo el 2026-08-06; el formulario ya se envió, así que
> esto es para no volver a decidirlo si hay que rehacerlo): nombre de la empresa =
> el nombre legal del usuario · display name = `Vibra MX` · categoría =
> **Entretenimiento** · sitio = `https://vibramx.fun/` · país = México · número =
> `+1 734 767 0241` (~$1.15/mes, con SMS y voz). Es de EE.UU. y no mexicano porque
> los mexicanos exigían documentación adicional. El SMS de verificación de Meta no
> llega (filtrado A2P): **pedir el código por llamada** y capturarlo con el twimlet.
> El checklist de "qué falta antes de pushear" está al inicio de este documento.

Meta **no deja crear plantillas de categoría AUTHENTICATION** sin el negocio
verificado (error `2388185`). O sea: **sin verificación no hay login por WhatsApp
para usuarios reales.** Se arranca desde "Verifica tu negocio" en el WhatsApp
Manager. Se descartó mover el OTP a SMS (decisión del usuario, 2026-07-29): se
espera la verificación.

⚠️ **Este documento decía "tarda 1–2 semanas". Era falso.** Al enviar la solicitud
(2026-08-01) Meta prometió respuesta en **2 días**. El dato de las semanas venía de
`fab2f0d` (2026-07-29), sin fuente conocida, y se repitió en tres lugares como si
fuera un hecho — llegó a usarse para justificar decisiones ("no vale la pena
reintentar, son otras dos semanas"). Si un plazo no viene de Meta ni de algo
comprobado, anótalo como suposición.

#### Intento de verificación 2026-07-31 — PAUSADO antes de subir documentos

Se recorrió el wizard completo (Centro de seguridad → Verificación del negocio)
sin enviarlo. El usuario decidió reintentar después. Estado y decisiones:

| Pantalla | Respuesta correcta para este caso |
|---|---|
| Tipo de negocio | **Sociedad unipersonal** (persona física; no hay acta constitutiva) |
| ¿Registrado oficialmente? | **Aún no registrado** — ver el hallazgo y la nota de abajo |
| Nombre del negocio | el nombre legal del usuario, como en la CSF |
| Nombre alternativo | **`Vibra MX`** — es lo que liga el nombre legal (una persona) con el display name del sender; sin esto Meta no tiene cómo conectarlos |
| Método de confirmación | **Verificación del dominio** (`vibramx.fun`, DNS en Hostinger) o correo `@vibramx.fun` |
| Tipo de documento | **"Constancia de Situación Fiscal SAT"** — Meta la lista explícitamente como Recomendado para México |

**🔴 El hallazgo que frena esto (2026-07-31):** el RFC del usuario está en régimen
**"Sin obligaciones fiscales"** y sin Nombre Comercial. Fiscalmente **no existe un
negocio**: hay una persona dada de alta y nada más. La CSF sí prueba nombre legal y
domicilio (que es lo que la pantalla pide literalmente), pero un revisor que lea el
régimen ve un RFC sin actividad empresarial respaldando un negocio. **No se sabe si
Meta lo rechaza** — no se llegó a enviar.

**✅ `vibramx.fun` VERIFICADO en Meta (2026-08-01).** Era el método de confirmación
elegido, y el que destrabó el wizard. Dos cosas que no son obvias:

1. El dominio **no estaba dado de alta** en el portfolio, así que "Verificar" mandaba
   a Configuración → Dominios con la lista vacía. Hay que agregarlo primero con
   **"Crear un dominio"** (el nombre engaña: no compra nada, solo lo registra en el
   portfolio) escribiendo `vibramx.fun` pelón — sin `https://`, sin `www`, sin `/`.
2. Método usado: **registro TXT en el DNS**, no metaetiqueta ni archivo HTML — los
   otros dos obligan a deployar a producción solo para verificar un dominio.

Registro que quedó en la zona de Hostinger (hPanel → Domains → `vibramx.fun` →
DNS/Nameservers → Manage DNS records). **No lo borres:** si desaparece, Meta puede
revocar la verificación del dominio.

```
TXT  @  facebook-domain-verification=ztgcxanbgcj0vi2fjhstdzxoxmyn55  TTL 14400
```

⚠️ El panel de VPS muestra los nameservers como `ns1/ns2.dns-parking.com`, pero los
autoritativos reales son `atlas` e `hyperion.dns-parking.com`. Es la misma zona y
funciona — pero si algún día un registro "no aparece", empezar por ahí.

**Por qué "Aún no registrado" y no "Registrado" (corregido 2026-08-01):** primero se
recomendó "Registrado" suponiendo que la otra ruta solo permitía verificar con
identificación personal, sin subir documentos. **Es falso: las dos rutas llegan a la
misma pantalla de subir documentos y aceptan la CSF.** Siendo así, lo único que
cambia es qué se le afirma a Meta. Con "Registrado" se afirma que el negocio está
inscrito ante el gobierno y luego se sube una constancia que dice "Sin obligaciones
fiscales" — el revisor ve una contradicción. Con "Aún no registrado" (*"o una persona
lo representa"*) no hay nada que contradecir y el mismo documento respalda lo que sí
prueba: identidad, nombre legal y domicilio fiscal.

No se sabe si Meta trata las dos rutas como niveles distintos de verificación para
desbloquear AUTHENTICATION. Entre una ruta consistente y una con una contradicción
adentro, se eligió la consistente.

Dos caminos cuando se retome:

- **A — intentarlo tal cual.** Bajar una CSF nueva del portal del SAT (la que se
  revisó era de 2024 y Meta pide documentos no caducados), capturar en Meta el
  **domicilio fiscal de la CSF** —que NO está en Monterrey, sino en otro estado— y
  subirla en PDF original del SAT, sin foto ni recorte. Costo de fallar: solo tiempo.
- **B — darse de alta con actividad empresarial** (RESICO o Actividades
  Empresariales) en el portal del SAT con la e.firma, y luego verificar. La CSF
  pasaría a mostrar un régimen real. Es el camino sólido pero mete un trámite.

Se recomendó **A** por el tiempo ya perdido en este bloqueo, con la expectativa
correcta: la CSF no es el documento fuerte que se asumía.

⚠️ **La dirección que se capture en Meta debe ser la de la CSF, no la de operación.**
Meta no verifica dónde vives; solo que documento y datos capturados digan lo mismo.
Ojo: el domicilio fiscal está en otro estado y la marca es de eventos **en
Monterrey**. No se cruzan en esta verificación, pero no coinciden.

Los datos personales (RFC, CURP, domicilio fiscal) **no van en este repo, que es
público** — están en la memoria privada del agente.

### ✅ El login SÍ se puede probar en local (2026-07-31)

La migración a plantillas había dejado el login **imposible de probar**, no sólo
imposible en producción: `plantillaOtp()` tronaba sin `TWILIO_CONTENT_SID_OTP` y no
quedaba ninguna vía de texto libre. Eso era autoinfligido, no una regla de Meta — el
texto libre **sí** se entrega dentro de la ventana de 24 h que abre el usuario al
escribirle al número. La restricción de Meta muerde con usuarios reales, que nunca
tienen esa ventana abierta.

Ahora `Plantilla` guarda el **nombre de la env var** (`envSid`) y el ContentSid se
resuelve **al enviar**, no al construir — antes `contentSid()` lanzaba en el
constructor, así que `sendPlantilla` nunca llegaba a decidir nada. Cada plantilla trae
además `textoPrueba`, el mismo mensaje en texto plano.

| Sin ContentSid en el entorno | Qué hace `sendPlantilla` |
|---|---|
| `WHATSAPP_TEST_MODE=true` | manda `textoPrueba` en texto plano + `console.warn` |
| `WHATSAPP_TEST_MODE=false` | **lanza**, y no envía nada |

**La segunda fila es el punto, no un detalle.** Un fallback silencioso en producción
convertiría "el login no funciona" en "funciona en pruebas y falla con usuarios
reales", que es mucho más caro de diagnosticar. Hay un test por rama y **se verificó
que el de producción falla si se le quita la condición `!testMode`** — no es un test
que pasaría de todos modos.

**Cómo probar en un teléfono real** (sin deployar nada):

```bash
TWILIO_WHATSAPP_FROM=+17347670241                              # sender de PRODUCCIÓN
TWILIO_CONTENT_SID_RECORDATORIO=HXdfa8086a05d711d7feaf5d52ce6d9e4b
TWILIO_CONTENT_SID_DIGEST=HX626b23de0d02f571a3a841967d6667b9
# TWILIO_CONTENT_SID_OTP  ← dejarla SIN definir: eso activa el texto libre
WHATSAPP_TEST_MODE=true                                        # todo va a ADMIN_WHATSAPP
```

- Recordatorio y digest van por **plantilla aprobada de verdad** → llegan aunque no
  haya ventana abierta. Ésa sí es la prueba real.
- El OTP sale como **texto libre** → hay que escribirle al `+1 734 767 0241` **primero**
  para abrir la ventana de 24 h; si no, rebota con `63016`.
- Tiene que ser el sender de producción: las plantillas viven en esa WABA, no en el
  Sandbox (que además ya aparece `OFFLINE`).

⚠️ **Lo que esta prueba NO demuestra:** que el login sirva para un usuario real. Ése
sigue roto hasta la verificación del negocio; el texto libre sólo funciona para quien
puede abrir la ventana a mano.

### ✅ El sitio ya se llama Vibra MX (2026-07-31) — commit `f24820e`, SIN PUSHEAR

El sitio se presentaba como **"Eventos MTY"** en el `<title>`, el logo del header y
el footer (`src/app/layout.tsx`), pero el dominio declarado ante Meta es
`vibramx.fun` y el display name del sender es **`Vibra MX`**. Como el respaldo del
display name ante Meta **ES el dominio**, un revisor que
abriera `vibramx.fun` buscando "Vibra MX" no encontraba la marca por ningún lado —
exactamente el rechazo de display name que ya estaba anticipado, con su castigo de
250 mensajes iniciados por el negocio cada 24 h.

Cambiadas las tres apariciones. Verificado desde fuera por el túnel: `<title>` dice
`Vibra MX — qué hacer en Monterrey` y el HTML ya no contiene "Eventos MTY".

⚠️ El repo, el directorio y el título de este documento siguen llamándose
`eventos-mty` / "Eventos MTY". Es solo cosmético e interno —Meta no lo ve— pero si
alguien renombra, que sea consciente de que el nombre de cara al público es
**Vibra MX** y el interno no.

### ⚠️ Estado efímero que hay que limpiar

1. ~~El webhook del sender apunta a un túnel muerto.~~ ✅ **RESUELTO (2026-07-31), y no
   era lo que decía esta nota.** El túnel **no estaba muerto**: `cloudflared` llevaba
   2.5 días vivo, así que **todo WhatsApp entrante al número de producción estuvo
   llegando a un `next-server` de desarrollo de este VPS** (puerto 3105), no a
   `vibramx.fun` — incluidos los "baja", que es justo el opt-out que Meta exige. Daño
   real ~nulo porque aún no hay usuarios. Ya se repuntó el `callback_url` del sender
   `XE4508db748ef8a40888bb3982835a01af` a `https://vibramx.fun/api/whatsapp/webhook`
   (POST, HTTP 202, verificado leyendo de vuelta) y se mataron los dos túneles con sus
   servidores. **Lección: "el túnel murió solo" es una suposición, no un hecho — se
   comprueba con `ps -eo pid,lstart,cmd | grep cloudflared`.**
2. **El `voice_url` del `+1 734 767 0241` apunta a un túnel que ahora sí está muerto.**
   Era el twimlet de la llamada de verificación de Meta
   (`scratchpad/twiml/server.js`, puerto 3108), apagado el 2026-07-31. Ya no graba
   nada; una llamada entrante simplemente falla. Conviene vaciarlo.
3. **Usuarios de prueba en la BD de desarrollo:** `+528100000091`, `+528100000092` y
   el número real del usuario (`+529223736016`). Solo en dev, no en prod.
4. **Plantillas de respaldo borradas (2026-07-31):** `HX97332f…` y `HX93686b…` ya no
   existen (`DELETE /v1/Content/{sid}` → 204). Tenían los bugs de copy viejos; se
   quitaron para que nadie las conecte por error.

### Variables de entorno que faltan en Coolify

```
TWILIO_WHATSAPP_FROM=+17347670241        # hoy sigue en el Sandbox (+14155238886)
TWILIO_CONTENT_SID_RECORDATORIO=HXdfa8086a05d711d7feaf5d52ce6d9e4b   # UTILITY, aprobada
TWILIO_CONTENT_SID_DIGEST=HX626b23de0d02f571a3a841967d6667b9         # v2, aprobada
TWILIO_CONTENT_SID_OTP=...               # NO EXISTE: bloqueada por la verificación
```

⚠️ **Los SIDs que decía esta lista hasta el 2026-07-31 (`HX97332f…`, `HX93686b…`) eran
de las plantillas de respaldo, que ya se borraron.** Configurarlos ahora daría un 404
de Twilio en cada envío. Los buenos son los de arriba.

**En producción `TWILIO_CONTENT_SID_OTP` tiene que faltar Y `WHATSAPP_TEST_MODE` ser
`false`** → `sendPlantilla` lanza y el login se cae. Ése es el motivo del ⛔ de arriba,
y es intencional: es preferible a un login que aparenta funcionar. El fallback de texto
libre **sólo** aplica en modo prueba.

`WHATSAPP_TEST_MODE=false` **hasta el final**, y solo cuando todo lo anterior esté.

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
npm test                    # tests puros, SIN BD — seguro con el dev server arriba
npm run test:borra-bd       # los *.db.test.ts; RESETEA la BD eventos_mty_test
npm run test:todo           # los dos (correr antes de pushear)
npm run dev                 # http://localhost:3000
npm run build               # build de producción
npm run ingest|digest|reminders   # jobs CLI
```

⚠️ **Los jobs `digest` y `reminders` en local necesitan `TZ=America/Monterrey`.** El
host está en UTC y el contenedor de prod no; `runDigest` compara `digestDay` contra
`now.getDay()`, así que sin la TZ el día sale distinto y no empata con nadie:
`TZ=America/Monterrey npx tsx scripts/digest.ts`. También necesitan las credenciales
de Twilio, que **no** están en el `.env` (salen de las env vars del contenedor de
prod: `docker exec … printenv`). Ver "Sesión 2026-08-01/02" para el flujo completo.

⚠️ **El `next dev` de los previews también quiere `TZ=America/Monterrey`**, por lo
mismo: sin ella la cartelera pinta las horas en UTC y parece un bug del conector
(un meetup "a la 1:00 am"). El contenedor de prod ya tiene ese `TZ` — verificado el
2026-08-06, no hace falta tocarlo. Y **`npm run ingest` en local necesita
`TICKETMASTER_API_KEY=…`** delante, porque en el `.env` está vacía; la llave sale
del contenedor de prod igual que las de Twilio.

### Tests: dos comandos, dos bases (desde 2026-07-27)
Antes había un solo `npm test` que **borraba la BD de desarrollo** en cada corrida
(los tests de integración llaman `resetDb()`, que necesita la base vacía para poder
afirmar conteos). Ese día se perdieron así los eventos locales. Ahora:

- **`npm test`** → solo los archivos `tests/*.test.ts` que NO tocan Postgres (49).
  No borra nada; se puede correr con un preview o el dev server arriba.
- **`npm run test:borra-bd`** → solo `tests/*.db.test.ts` (21), con
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
  `false` antes de eso. El `+521` ya no bloquea (arreglado 2026-07-29); lo que
  bloquea ahora es la verificación del negocio y las plantillas.
  ⚠️ **El modo prueba ya no puede etiquetar el mensaje** con `[PRUEBA → +52…]`: el
  cuerpo de una plantilla es fijo. El destinatario real se registra en consola.
- ~~**FORMATO `+521`**~~ ✅ **ARREGLADO (2026-07-29, sin pushear).** El helper
  `mxWhatsAppNumber` (`src/lib/auth/phone.ts`) repone el `1` al enviar, sin tocar el
  almacenamiento canónico `+52` que sirve al dedup. Es idempotente. Contexto del bug:
  a `+529223736016` (sin `1`) → err 63015; a `+5219223736016` → err 63016 (número
  reconocido). Los fixtures de los tests de BD **usaban teléfonos imposibles** (`+52`
  + 8 dígitos, que `normalizeMxPhone` nunca produce) y por eso no lo detectaban.
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
- **CONARTE y Luma: investigadas el 2026-08-03/05 e IMPLEMENTADAS el 2026-08-05.
  Superboletos: investigada e IMPLEMENTADA el 2026-08-06. AREMA: investigada e
  IMPLEMENTADA el 2026-08-07.** Todo lo vigente de las seis fuentes —cómo están
  implementadas, sus trampas y las defensas de cada una— vive ahora en **`FUENTES.md`**,
  que sustituyó a los dos reportes por fuente el 2026-08-06 (siguen en el historial de
  git).
  - ⚠️ **Ninguna de las cuatro está en producción**: `origin/main` sigue con
    `ticketmaster` y `arena-monterrey`. Falta pushear.
  - **Sin explorar: ninguna.** Los dos que quedaban se cerraron el 2026-08-07 sin
    necesitar conector: Auditorio Pabellón M ya entraba por Ticketmaster como
    "Escenario GNP Seguros" y el Teatro de la Ciudad ya entraba por CONARTE. La Arena,
    Superboletos y AREMA demostraron que conviene buscarles la API interna antes de
    asumir scraping — las tres la tenían.
  - **Facebook, Instagram y Eventbrite: descartados** el 2026-08-06 por acceso
    cerrado, no por dificultad. **Boletia:** descartado el 2026-08-07 por lo mismo
    (403 a todo, incluso a `robots.txt`). **Fever:** reconocida a fondo y viable,
    sin implementar por decisión del usuario — la ficha de `FUENTES.md` alcanza
    para escribir el conector sin repetir el reconocimiento. Razones en `FUENTES.md`.
- **Dominio real: COMPRADO `vibramx.fun`** (2026-07-28, en Hostinger; expira
  2027-07-28). DNS ya propagado y verificado en Google/Cloudflare/Quad9:
  `vibramx.fun` y `www.vibramx.fun` → `187.127.254.144` (IP pública del VPS,
  confirmada con `api.ipify.org`, no deducida del `sslip.io`). Registros en hPanel:
  `A @ → 187.127.254.144` (TTL 60) y `CNAME www → vibramx.fun`; se borró el A de
  parking (`2.57.91.91`). El nombre se eligió **sin "MTY" a propósito**, por la
  expansión nacional de arriba. Display name previsto para Meta: `Vibra MX`.
  **YA EN PRODUCCIÓN (2026-07-28):** se agregaron `https://vibramx.fun` y
  `https://www.vibramx.fun` a los dominios de la app en Coolify (vía API, campo
  `domains`, conservando el `sslip.io`), se cambió la env var `BASE_URL` a
  `https://vibramx.fun` (env uuid `nm9y0c9o32ttfo7k8lioosio`) y se redesplegó
  (deployment `p10qnjlijjlczn82b7vho6gk`, `finished`). Verificado desde fuera:
  los tres dominios responden 200 con TLS válido y `http://vibramx.fun` redirige
  302 a HTTPS. El certificado de Let's Encrypt salió solo.
- ~~QUITAR EL DOMINIO `*.sslip.io`~~ ✅ **HECHO (2026-07-28).** `vibramx.fun` y
  `www.vibramx.fun` son ahora los únicos dominios de la app. Se hizo con
  `PATCH /api/v1/applications/{uuid}` (campo `domains`) + redeploy
  (`zy1w2z295rcvrspghgaxbjkj`, `finished`). Verificado: los dos dominios nuevos dan
  200, `http://vibramx.fun` redirige 302 a HTTPS, el HTML ya no contiene la cadena
  `sslip.io`, y el dominio viejo responde **503** (Traefik ya no tiene ruta).
  **Las tres condiciones previas resultaron ser dos falsas alarmas y una real:**
  1. ✅ El certificado de Let's Encrypt de `vibramx.fun` funciona (era la real).
  2. ⚠️ "El webhook de Twilio apunta al `sslip.io`" era **falso** — nunca apuntó a
     la app en absoluto (ver el bug de "baja" abajo). No había nada que romper.
  3. ⚠️ "Esperar a que `BASE_URL` salga en un digest" era **vacío** — en prod hay un
     solo usuario (el número del admin) y su `digestDay` es `NULL`, así que no se
     está enviando ningún digest a nadie.
- **Nota menor:** el juego de env vars con `is_preview: true` todavía tiene el
  `BASE_URL` viejo (`…sslip.io`, env uuid `tkhlszrej87jpwdh6c1yyrg5`). No afecta a
  producción (sólo aplicaría a deploys de preview, que no se usan), pero conviene
  limpiarlo para que nadie lo lea como el valor bueno.

**📄 Se escribió `META-WHATSAPP.md` (2026-07-28)** con el plan completo para salir
del Sandbox. **Borrado el 2026-08-06 al consolidar los docs**, porque casi todo ya
estaba implementado o superado; lo que seguía vivo se subió al § "LO PRIMERO" del
inicio de este documento. El original se recupera con
`git show 88f6b70:META-WHATSAPP.md` — ahí quedan los precios de plantillas para
México, el trámite en orden y las trampas del Embedded Signup. **Era el camino
crítico del proyecto:** sin sender aprobado no puede haber usuarios reales.

**⏳ TRÁMITE DE META ARRANCADO EL 2026-07-28 — quedó a medias.** Se compró el número
`+1 734 767 0241` en Twilio y el Embedded Signup llegó hasta el paso de verificar el
número; falta meter el código y terminar. **(Resuelto al día siguiente: el sender
quedó registrado y online el 2026-07-29 — ver esa sesión.)**

Lo que se decidió aquí y sigue vigente —display name `Vibra MX`, categoría
Entretenimiento, por qué el número es de EE.UU. y no mexicano— está recogido en la
nota del § "El bloqueo real: verificación del negocio". De las trampas pisadas, la
que más cuesta olvidar: **la verificación por SMS es imposible con un número de
Twilio** por filtrado A2P de operadora — hay que pedir el código **por llamada**.

⚠️ Estado efímero que quedó de esa sesión: el `voice_url` del número apunta a un
túnel de Cloudflare muerto. Hay que rehacerlo o limpiarlo.

**Pendiente (código — siguiente sesión):**
- Refinamiento visual fino del rediseño (el usuario quiere funcionalidad primero,
  pulir al final).
- (El bug de `reminderSentAt` ya se arregló — ver "Resuelto (2026-07-27, tercera tanda)".)
- ~~Apuntar el webhook del Sandbox a la app~~ ✅ **HECHO (2026-07-28).** El
  `callback_url` del sender `XEfa539e8303cb08c337a9bfbdab02ab0b` es ahora
  `https://vibramx.fun/api/whatsapp/webhook` (POST). **La escritura por API SÍ
  funciona** sobre el sender del Sandbox — no hace falta la consola:
  `POST https://messaging.twilio.com/v2/Channels/Senders/{sid}` con
  `{"webhook":{"callback_url":"…","callback_method":"POST"}}` → HTTP 202.
  El Auth Token sale de las env vars del contenedor (`docker exec … printenv
  TWILIO_AUTH_TOKEN`), sin necesidad de exponerlo.
  **Orden seguido a propósito:** primero el fix del código en prod, después el
  webhook. Apuntarlo antes habría cambiado "te contesta el demo de Twilio" por
  "nuestra app te confirma una baja que no ocurrió", que es peor — y la prueba
  habría salido en verde por la razón equivocada.
  **Efecto secundario ya vigente:** *todos* los entrantes del sandbox llegan a la
  app, y el handler responde `<Response/>` vacío a lo que no sea "baja" → mandar
  `hola` para reabrir la ventana de 24 h ya no tiene respuesta visible (la ventana
  sí se reabre; eso lo maneja Meta, no el webhook).
  - Pendiente de decidir: si "baja" debe apagar también los recordatorios de
    eventos guardados (`SavedEvent.reminder`), no sólo el digest. Hoy sólo pone
    `digestDay = null`, así que quien escriba "baja" esperando "ya no me manden
    nada" seguirá recibiendo recordatorios. Para el opt-out que Meta exige en
    plantillas MARKETING probablemente no alcanza.
  - ~~El match es exacto (`body === "baja"`, ya en minúsculas y sin espacios): no
    entra `darme de baja` ni `baja.`.~~ ✅ **ARREGLADO (2026-08-03, commit `a6177b0`,
    sin pushear):** `esBaja()` acepta las variantes. Ver "Sesión 2026-08-03".
  - **Cómo se descubrió (2026-07-28):**
    `GET https://messaging.twilio.com/v2/Channels/Senders?Channel=whatsapp` (auth
    básica con el Account SID + Auth Token) → el `webhook.callback_url` del sender
    `whatsapp:+14155238886` era `https://timberwolf-mastiff-9776.twil.io/demo-reply`,
    la función demo por defecto de Twilio. Ese mismo GET sirve para verificar que el
    cambio quedó.
  - La palabra clave no se anuncia en ningún lado de la app. En `/perfil` la opción
    dice `No enviarme el resumen (baja)` (`src/components/PerfilForm.tsx:99`) — ese
    "(baja)" no explica nada y confunde. Cambiarla a `No enviarme el resumen` + un
    texto de ayuda que enseñe la palabra clave.
    **Menos urgente desde el 2026-08-03:** el cuerpo aprobado del digest ya la enseña
    ("Responde BAJA para dejar de recibir este resumen") y `esBaja()` acepta variantes,
    así que la app ya no es el único lugar donde podría aprenderse. El texto de
    `/perfil` sigue igual de confuso.
- **Reintento real de recordatorios — DESPUÉS de las plantillas (decidido 2026-07-28).**
  Hoy el cron corre 1 vez al día y la consulta filtra eventos de *mañana*, así que un
  rebote no se reintenta nunca (a la siguiente pasada el evento ya es hoy y sale de la
  ventana). El plan es **cron cada hora + ventana "próximas 12–36 h"**, pero **no antes
  de tener plantillas de Meta**: contra un 63015/63016 el reintento sólo repite el mismo
  rechazo estructural, gastando mensajes para el mismo silencio. Al hacerlo, dos cosas
  que no son obvias:
  - **La copia se rompe:** el mensaje dice "Mañana es X" y con ventana de 12–36 h un
    evento puede caer **hoy en la noche**. Calcular el texto contra la fecha real.
  - **Hace falta tope de reintentos** (columna `reminderAttempts`, cortar a los 3–4).
    Sin tope, un número que rechaza siempre se reintentaría ~36 veces por evento: quema
    dinero y **baja la calificación de calidad del sender**, que es justo lo que Meta usa
    para limitar o pausar las plantillas. Se dejó fuera del fix de 2026-07-27 a propósito,
    porque sin reintento real no servía de nada.

**Resuelto (2026-07-28):**
- ✅ **"baja" por WhatsApp: arreglada la normalización del `+521` y las confirmaciones
  falsas** (`src/lib/auth/phone.ts`, `src/app/api/whatsapp/webhook/route.ts`).
  `mxNationalDigits` ahora quita el prefijo `521` de 13 dígitos — es la **raíz**, y
  como es el helper compartido, el mismo número entra igual por el login que por
  WhatsApp. El webhook normaliza el `From` y **solo** confirma si `updateMany` tocó
  una fila; si no empata (o el `From` no es un móvil MX) responde diciéndolo y lo
  loguea, en vez de mentir. Tests: 5 nuevos en `tests/phone.test.ts` y
  `tests/whatsapp-webhook.db.test.ts` con los 5 caminos del handler. **Se verificó
  que los 2 tests clave fallan si se quita la normalización** (no son tests que
  pasarían de todos modos), y end-to-end por HTTP contra el build de producción
  (`digestDay` 1 → NULL mandando el `From` con `+521`). **80 tests** (54 puros + 26
  de BD), lint y build limpios.
  **EN PRODUCCIÓN Y VERIFICADO (2026-07-28):** pusheado (commit `5d6dd59`) y
  desplegado (`s70k0d46zyjv2etitkbtedh0`, `finished`), con el webhook del Sandbox ya
  apuntando a la app. Dos verificaciones independientes:
  1. **Con un mensaje real de WhatsApp, antes de pushear:** se apuntó el sandbox a un
     túnel de Cloudflare contra un server local con el fix y la BD desechable; el
     usuario mandó `baja` desde su teléfono y el `digestDay` pasó de `1` a `NULL`.
     Es la primera vez que ese handler corría con el payload real de Twilio.
  2. **Contra prod ya desplegado**, sin tocar datos (números que no existen en la BD,
     así el `updateMany` no puede afectar a nadie): un `+521` válido inexistente
     responde "No encontramos una cuenta", un `From` que no es móvil MX responde "No
     pudimos identificar tu número", y un mensaje que no es "baja" responde vacío.
     **Con el código viejo los tres primeros habrían contestado "Listo, ya no
     recibirás el resumen"** — ése es el discriminador que prueba que el fix está
     arriba.
- ✅ **`*.sslip.io` retirado; `vibramx.fun` es el único dominio** — ver el detalle en
  la sección de pendientes de FASE 4 (arriba). Cambio sólo de infraestructura
  (Coolify), sin tocar código.
- ✅ **Cookie de sesión con `secure` en producción** (`src/lib/auth/session.ts`). La
  cookie `session` ya era `httpOnly` + `sameSite: lax` + firmada con HMAC, pero le
  faltaba `secure`, así que nada impedía que viajara en claro si algo llegaba por
  `http://`. Se activa **solo con `NODE_ENV === "production"`**: en dev los previews
  por IP del VPS / `sslip.io` son http y con `secure` el browser descartaría la
  cookie (no se podría ni entrar). Verificado en un build de producción: el
  `Set-Cookie` de `/api/auth/verify` responde `Secure; HttpOnly; SameSite=lax`.
  Nota: sigue sin haber revocación — la cookie es un HMAC del `userId`, no un token
  en BD, así que "cerrar sesión" solo la borra del browser y la única invalidación
  global es rotar `SESSION_SECRET`.
- ✅ **Quitado el "(baja)" del selector de resumen** (`src/components/PerfilForm.tsx`):
  la opción ahora dice solo "No enviarme el resumen". El "baja" era jerga del webhook
  de WhatsApp (`body === "baja"`), no algo que el usuario tenga que ver en el perfil.

**Resuelto (2026-07-27, tercera tanda):**
- ✅ **`reminderSentAt` ya no se marca cuando el WhatsApp rebota**
  (`src/lib/reminders/run.ts` + `src/lib/whatsapp.ts`). El bug: `messages.create()`
  de Twilio devuelve `queued` **sin lanzar excepción** y el rebote real (63016 fuera
  de la ventana de 24 h, 63015 número no unido) llega segundos después de forma
  asíncrona; como el código marcaba `reminderSentAt = now()` justo tras el `create`,
  un recordatorio rebotado quedaba como enviado y **nunca se reintentaba**.
  Ahora: `sendWhatsApp` **devuelve** el mensaje (`sid`/`status`/`errorCode`),
  `MessageSender` gana un `fetch(sid)` opcional, y `confirmarEntrega()` releé el
  estado con esperas crecientes (2/3/5/8/12 s, ~30 s tope) hasta un estado terminal.
  - `failed`/`undelivered`/`canceled` → **no** se marca `reminderSentAt`; se guardan
    `reminderStatus`/`reminderError` y sigue elegible para el próximo run.
  - `delivered`/`read` → se marca, con `reminderSid`/`reminderStatus`.
  - Sigue provisional a los ~30 s (`queued`/`sending`/`sent`) → se marca igual
    (`indecisos`), porque duplicar un recordatorio es peor que perderlo. **`sent` NO
    cuenta como entregado**: sólo dice que Twilio se lo pasó a Meta y todavía puede
    caer en `undelivered`.
  - Migración `20260727203745_recordatorio_estado_entrega`: `SavedEvent` gana
    `reminderSid`, `reminderStatus`, `reminderError` (aditiva, no toca datos).
- ✅ **Un destinatario que truena ya no tumba el lote** (recordatorios *y* digest):
  antes una excepción en cualquier envío abortaba el `for` y los usuarios restantes
  se quedaban sin nada. Ahora es `try/catch` por destinatario, con el error guardado
  en `reminderError` y logueado.
- ✅ **Los jobs ya no se tragan los fallos:** `runReminders` devuelve
  `{ enviados, fallidos, indecisos }` (antes un `number`) y `runDigest` suma
  `failed`. `scripts/reminders.ts` y `scripts/digest.ts` lo imprimen y **salen con
  código 1 si hubo fallos**, para que la Scheduled Task de Coolify marque la corrida
  como fallida en vez de reportar éxito.
- ✅ **Verificado end-to-end contra Twilio real (2026-07-27)**, corriendo
  `npm run reminders` contra la BD desechable `eventos_mty_test`:
  - Camino feliz: mensaje entregado al WhatsApp del admin → `reminderStatus=delivered`,
    `reminderSid=SMfa7c21…`, `reminderSentAt` marcado, exit 0.
  - Camino del bug: mismo número **sin el `1`** (`+529223736016`, el formato que la
    app guarda hoy) → Twilio aceptó el `create` y rebotó async con **63015**. El job
    imprimió `0 enviados, 1 fallidos`, dejó `reminderSentAt` en **null**, guardó
    `reminderStatus=failed` / `reminderError=63015…` y **salió con código 1**. Antes
    ese mismo caso reportaba "1 enviado" y se perdía en silencio.
- **Nota:** esto detecta y no miente, pero **no arregla la causa** de los rebotes —
  la ventana de 24 h del Sandbox sigue ahí. Con el cron diario a las 10:00 y la
  ventana de consulta fija en "mañana", un rebote hoy no se reintenta mañana (el
  evento ya sería hoy). El reintento real llega con las plantillas de Meta.
- **70 tests** (49 puros + 21 de BD), lint y build limpios.

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
- Contrato: `src/lib/events/types.ts` (`NormalizedEvent` y `CATEGORIES`, que es la
  fuente de verdad de las 5 categorías: agregar una es editar ese array)
- Cómo se ve cada categoría (nombre, emoji, clases de color):
  `src/lib/events/categorias.ts`. Lo usan cartelera, detalle y perfil — antes
  estaba copiado en los tres. Va tipado `Record<Category, …>` para que olvidar
  una sea error de compilación y no un chip gris en producción.
- Ingesta: `src/lib/ingest/` (jsonld, llm, page-connector, registry, run, y
  `sources/{ticketmaster,arena-monterrey,conarte,luma}`) + `scripts/ingest.ts`.
  El criterio de "fuente caída" vive en `connector.ts` (`hayCaida`, `minExpected`).
- Dedupe/upsert: `src/lib/events/{normalize,upsert}.ts`
- Web: `src/app/` (page = Explorar, eventos/[id], entrar, perfil, mis-eventos,
  admin/salud) + `src/app/api/`
- WhatsApp/auth: `src/lib/whatsapp.ts`, `src/lib/auth/{otp,session}.ts`
- Digest/recordatorios: `src/lib/digest/`, `src/lib/reminders/` + `scripts/`
