# Fuentes de eventos — cómo están implementadas

> Un solo documento para las siete fuentes. **Sustituye a `FUENTE-CONARTE.md` y
> `FUENTE-LUMA.md`** (borrados el 2026-08-06 al consolidar; los reportes de
> reconocimiento completos —con los apéndices de curl y las mediciones crudas—
> siguen en el historial de git y se recuperan con
> `git show 88f6b70:FUENTE-LUMA.md` / `git show 88f6b70:FUENTE-CONARTE.md`
> (`88f6b70` es el último commit en que existían; verificado).
>
> Esto describe **lo que está implementado hoy** y por qué está escrito así. La
> narrativa por sesiones vive en `HANDOFF.md`; aquí sólo lo que sigue siendo cierto.
>
> Última revisión: 2026-08-07.

## De un vistazo

| Fuente | slug | Cómo se obtiene | Rinde | `minExpected` | Qué aporta que las demás no |
|---|---|---|---|---|---|
| Ticketmaster MX | `ticketmaster` | API oficial con llave | ~87 | 5 (default) | El grueso del volumen: conciertos y teatro con boleto |
| Arena Monterrey | `arena-monterrey` | API JSON no documentada de su sitio | ~49 | 5 (default) | Lo que vende Superboletos en ese venue, que Ticketmaster casi no trae |
| CONARTE | `conarte` | Scraping de HTML, 2 etapas | ~12 | 2 | Cultura pública y **gratuita**: nadie la vende, así que ninguna boletera la tiene |
| Luma | `luma` | API interna de su discover | ~16 | 2 | Meetups, venues chicos, tech y bienestar autogestionados |
| Superboletos | `superboletos` | JSON del catálogo en su CDN | ~88 | 5 (default) | Showcenter Complex y Dion Live Center, que ninguna otra fuente ve |
| AREMA Ticket | `arema` | API JSON no documentada, 2 etapas | ~143 | 5 (default) | Los venues chicos del área metro (Río 70, Café Iguana, Dramático) y la única masa de comedia |
| Fever | `fever` | JSON embebido en el HTML, 2 etapas | ~56 | 5 (default) | Lo que no es boletera: Candlelight, museos, experiencias inmersivas y juegos callejeros |

Registro de conectores: `src/lib/ingest/registry.ts`. **Agregar una fuente es
agregar una entrada ahí.** La ingesta corre 1×/día por cron (`0 12 * * *` UTC =
06:00 MTY).

---

## Reglas que valen para cualquier fuente nueva

Salieron de errores concretos, no de teoría. Vale la pena leerlas antes de escribir
el siguiente conector.

**1. Una fuente que se apaga en silencio es peor que una que revienta.** Todo
conector debe distinguir *"hoy no hay eventos"* de *"ya no sé leer esta fuente"*. La
red global (`hayCaida()` en `connector.ts`) sólo alerta si la corrida previa trajo
`minExpected` y ésta trajo 0; **no ve** el caso de una fuente que responde 200 y de
la que no sale nada. Eso lo tiene que detectar el conector.

**2. `minExpected` por conector, no un umbral global.** El default es 5. Las fuentes
chicas (CONARTE, Luma) rondan justo ese número, así que con el umbral global una
caída a cero **no habría alertado nunca**.

**3. El mapeo de categorías vive en el conector, no en el modelo.** `CATEGORIES` es
nuestro, no de la fuente. Si mañana entra Eventbrite con su taxonomía, hace lo
mismo por su lado.

**4. `0` no es `undefined`.** Un precio `0` es un dato real (entrada libre); ausente
es "no sé". Colapsarlos hace que la web diga "desde $0" o que se pierda el "Gratis".

**5. Para verificar un conteo, cuenta por un camino distinto al del código que lo
generó.** El 2026-08-05 se "verificó contra el sitio real" que CONARTE daba 5
eventos, usando el mismo parseo que tenía el bug: la verificación heredó el punto
ciego y devolvió "confirmado". Eran 12. Mirar el HTML crudo y contar los `<a href>`
a mano fue lo que lo destapó.

**6. Cortesía:** `User-Agent` identificable con contacto
(`eventos-mty/1.0 (+https://github.com/…)`), concurrencia limitada (≤ 4) y no
barrer más ventana de la que se usa. El digest sólo mira 10 días.

**7. Una fuente que pisa un venue ya cubierto va a colar duplicados, y hay que
contarlos a ojo.** El dedupe es venue + día + `sameEventTitle`, y esa función
(`src/lib/events/normalize.ts`) compara por igualdad o **substring**: aguanta que
sobre texto al principio o al final, no que se meta una palabra en medio. Cada
boletera titula distinto el mismo show, así que al agregar una fuente que comparte
recinto **hay que listar los pares mismo-venue/mismo-día y mirarlos**, no contar con
`sameEventTitle` — contar con la misma función que dedupea siempre da cero (regla 5).

**8. Antes de asumir scraping, búscale la API interna.** Cuatro de las seis fuentes
la tenían (Arena, Luma, Superboletos, AREMA) y ninguna está documentada. La receta,
en orden de esfuerzo:

1. `curl` la página de cartelera y buscar en el HTML el título de un evento que se
   vea en el navegador. **Si no está, lo pone el JS y hay un endpoint detrás.**
2. Si sí está, buscar `<script type="application/ld+json">` antes de escribir un
   parser propio.
3. Para encontrar el endpoint: DevTools → Network → filtro XHR/Fetch. Sin navegador,
   bajar el bundle (`/static/js/main.<hash>.js`, `/_next/static/chunks/...`) y
   grepearlo por URLs (`https://[a-z0-9.-]+`) y por variables de configuración —
   `REACT_APP_API_URL` delató a AREMA y `NEXT_PUBLIC_CDN_CONTENT_VERSION` a
   Superboletos. Los nombres de ruta suelen estar sueltos como cadenas
   (`"events/list"`), y el método importa: los dos de AREMA son **POST**.
4. Medir cuántas peticiones cuesta una corrida completa **antes** de escribir el
   conector. Superboletos son 3 fijas; AREMA, 1 + una por evento.

⚠️ Dos cosas que la receta no decide: si la fuente **bloquea clientes no-navegador**
(Boletia da 403 hasta a su `robots.txt`), ahí se acaba el camino — no se evade. Y los
**términos de uso** hay que leerlos aparte: los de Luma, Superboletos y AREMA siguen
sin revisar.

---

## Duplicados conocidos entre fuentes

Medido el 2026-08-06 sobre 213 eventos futuros en la BD dev, con las 5 fuentes:
**45 eventos se fusionaron bien** (uno con tres fuentes a la vez), y **2 se escaparon**:

| Uno | El otro | Por qué se escapó |
|---|---|---|
| `HARLEM GLOBETROTTERS 2026` (arena) | `HARLEM GLOBETROTTERS MONTERREY 2026` (superboletos) | "monterrey" se mete en medio, así que ninguno es substring del otro |
| `SIN BANDERA: ESCENAS TOUR` (arena) | `SIN BANDERA DIC 2026` (superboletos) | sólo comparten el nombre del artista |

Los dos son a la **misma hora exacta**, no sólo el mismo día.

**Lo que NO son duplicados**, aunque compartan venue y hora, y que conviene no
"arreglar": los add-ons que las boleteras venden por separado — `JAMIROQUAI VIP TOUR
PACKAGE`, `LULI PAMPIN- M&G MONTERREY`, `CELEBRITY COURT PASS` y `MAGIC PASS`. Mismo
patrón que el `Superarte JQ & LT M&G UPGRADE` de Ticketmaster.

⚠️ **Cuidado con la solución obvia.** Relajar `sameEventTitle` a "solapamiento de
palabras" fusionaría `CELEBRITY COURT PASS MONTERREY 2026` con `MAGIC PASS MONTERREY
2026` —3 de 4 tokens en común, misma hora, productos distintos—. La regla conservadora
que sí sirve es **subconjunto de tokens**: arregla Globetrotters y deja los add-ons en
paz. `SIN BANDERA` no lo arregla ninguna regla conservadora, y fusionarlo por artista
uniría dos shows distintos del mismo artista.

**Ticketmaster ya duplicaba solo, desde antes:** `5 Seconds of Summer` vs `5SOS - BITE
THE APPLE UPGRADE`, y `Dale Mixx 2026` partido en cuatro (GENERAL, Lockers, COMFORT
PASS, Banamex VIP).

**Lo que agregó Arema (medido el 2026-08-07 sobre la BD dev, con las 6 fuentes):**
**cero** de sus 143 eventos se fusionó con otra fuente —ningún choque real de venue +
día + título— y 17 se fusionaron *entre sí*, que son funciones del mismo show el mismo
día (matiné y noche), el comportamiento correcto del dedupe. El único duplicado nuevo es
el mismo bug de arriba:

| Uno | El otro | Por qué se escapó |
|---|---|---|
| `34 Mitote Folklórico, Muestra Nacional de Danza Folklórica` (arema) | `34 Mitote Folklórico – Día 5 – Gran Sala` (conarte) | el nombre del festival es prefijo común, pero ninguno es substring del otro |

Son 2 eventos (8 y 9 de agosto de 2026, Teatro de la Ciudad) y se van solos cuando acabe
el festival. Ojo: los dos bloques de CONARTE del mismo día **no** son duplicados entre sí
— Gran Sala y Escenario al Aire Libre son funciones distintas.

Un caso que **parece** duplicado y no lo es: `Jedicon en Monterrey` (arema) y `Nach`
(ticketmaster), mismo día y mismo venue (Escenario GNP Seguros). Una convención y un
concierto en el mismo recinto; que no se fusionen es lo correcto.

**Lo que agregó Fever (medido el 2026-08-07 sobre la BD dev, con las 7 fuentes): ningún
duplicado posible.** Sus 56 eventos caen en 11 venues y **ninguna otra fuente tiene un
solo evento en ninguno de los 11** — el dedupe es venue + día + título, así que sin venue
compartido no hay choque que revisar. La lista completa de venues de la BD también se miró
a ojo por si Fever hubiera creado un alias de uno existente (regla 7): no, los 11 son
recintos que ninguna boletera vende (Museo de Historia Mexicana, Saxy Jazz, Teatro
Versalles, Papalote, Macroplaza…). Es la única fuente hasta ahora con solape cero **por
construcción** y no por casualidad: no vende conciertos de boletera.

---

## Las 5 categorías, y cómo se decide

`CATEGORIES` (`src/lib/events/types.ts`) es la fuente de verdad; cómo se ve cada una
está en `src/lib/events/categorias.ts`.

| Categoría | Qué entra |
|---|---|
| `musica` | conciertos, listening parties, recitales |
| `deportes` | **espectáculo** deportivo: Rayados, Sultanes, lucha libre, box |
| `cultura` | teatro, danza, cine, literatura, exposiciones, talleres artísticos |
| `tecnologia` | meetups, conferencias, bootcamps, IA, cripto, emprendimiento |
| `bienestar` | pilates, yoga, running, salud, nutrición |

**La regla de clasificación:** se clasifica por *a qué va la gente* —aprender de una
industria → `tecnologia`; salir → `cultura`; moverse o cuidarse → `bienestar`—,
nunca por el formato del evento ni por el nombre que le puso la fuente.

Dos que se descartaron a propósito, y siguen descartadas:

- **Fitness no va en `deportes`.** Hoy "Deportes" significa ir a *ver* un partido; el
  Fitness de Luma es ir a *hacer* pilates. Quien filtra por Deportes buscando un
  juego no quiere un diplomado de reformer.
- **Los meetups no van en `cultura`.** `cultura` ya absorbe casi todo CONARTE (21
  disciplinas colapsadas); con los meetups encima deja de significar nada y el
  digest empieza a mandarle charlas de fintech a quien marcó "🎭 Cultura y teatro".

⚠️ Las categorías nuevas **nacen desmarcadas** para todos los usuarios y se decidió
no poner aviso: nadie recibe `tecnologia` ni `bienestar` en el digest hasta que entre
a `/perfil` y las marque.

⚠️ **`upsertEvents` no actualiza `category`**: sólo la escribe al crear
(`src/lib/events/upsert.ts`). Un evento ya guardado conserva su categoría aunque el
conector aprenda a clasificarlo mejor. No se cambió porque afecta a todos los
conectores y abre el caso de dos fuentes que cubren el mismo evento (Ticketmaster y
Arena lo hacen) pisándose la categoría en cada corrida. **Pendiente con nombre
propio** para cuando haya que reclasificar algo ya ingerido.

---

## Ticketmaster MX — `ticketmaster`

API oficial de Discovery, con `TICKETMASTER_API_KEY`. Una sola petición:
`city=Monterrey&countryCode=MX&size=100`. Es la fuente de mayor volumen y la única
con contrato estable.

**Sólo se mapean 3 segmentos** (`Music` → `musica`, `Sports` → `deportes`,
`Arts & Theatre` → `cultura`). Todo lo demás se descarta.

- **Medido el 2026-08-05 con la llave de prod: son 2 de 89**, ambos `Miscellaneous`,
  y uno ni siquiera es un evento (`Superarte JQ & LT M&G UPGRADE (Boleto de evento
  no incluido)`, un meet & greet que se vende aparte). Así que el mapa está bien.
- Ese descarte **antes era mudo**. Ahora el conector avisa con el conteo por
  segmento, para que un día en que Ticketmaster mueva las cosas de segmento se vea.
- Dato no explotado: esa consulta trae **0 eventos de `Sports`**. Rayados y Sultanes
  no entran por `city=Monterrey`.

⚠️ En el `.env` local la llave está **vacía** (en Coolify sí está): en local hay que
correr `TICKETMASTER_API_KEY=… npm run ingest` o esa fuente sale `✗`.

---

## Arena Monterrey — `arena-monterrey`

API JSON del propio sitio (`api.arenamonterrey.com/next_event_dates`, `location=10`).
Su cartelera es una SPA sin JSON-LD, así que el `pageConnector` genérico daba 404.

- **El `Venue` se llama exactamente igual que en Ticketmaster** ("Arena Monterrey")
  para que el dedupe (venue + día + título similar) fusione los eventos que traen
  las dos fuentes. Cambiar ese string duplica media cartelera.
- Las "categorías" del API son géneros musicales, así que la categoría sale del
  título: `deportes` sólo para WWE, Globetrotters, lucha libre y box; el resto
  `musica`.
- Los banners vienen como `http://`; se reescriben a `https://` para no romper la
  página con contenido mixto.
- Un evento con varias fechas emite un `NormalizedEvent` por fecha.

---

## CONARTE — `conarte`

Scraping del HTML de `conarte.org.mx/agenda/`. Cultura pública de Nuevo León, casi
toda de entrada libre.

### Cómo funciona

Dos etapas: (1) barrido día por día (`?fecha=YYYYMMDD`, 21 días) que junta URLs de
detalle; (2) una petición por evento único, de donde salen fecha, sede, disciplina,
precio e imagen. Un evento recurrente aparece en varios días → se deduplica por URL,
y su página de detalle emite un bloque `atc_event` por ocurrencia.

**La REST API de WordPress NO sirve** — no construyas sobre ella. `/wp/v2/agenda`
expone 3,975 registros, pero `date` es la fecha de **publicación**, `acf` viene
vacío y no hay sede, costo ni horario. Un evento publicado el 16-jul que ocurre el
29-ago no tiene esa fecha en el JSON.

### Trampas y dónde está la defensa

| Trampa | Defensa |
|---|---|
| **La fecha es *timezone-naive*** (`2026-08-06 18:30:00`, sin offset) y se corre 6 h si se parsea directo | `fechaZonaAUtc()` aplica la zona de `atc_timezone` con `Intl`. Los tests corren el mismo caso bajo `TZ=UTC`, `America/Monterrey` y `Asia/Tokyo` — un parseo ingenuo *funciona en prod y falla en local*, que es el peor modo de fallar |
| **La diagonal final es obligatoria**: `/agenda?fecha=` es 301 con cuerpo vacío | La URL se escribe con diagonal, y hay test |
| **Los días vacíos traen un `<li>` señuelo** con `no-events` | `parseListado()` lo descarta; contarlo producía eventos fantasma con todo en null |
| **El filtro `lugar` está roto**: devuelve otra plantilla, sin resultados que parsear | Se consulta **sólo** por `fecha` y se filtra del lado nuestro. El filtro `disciplina` no se probó: asumir que es igual de frágil |
| El `kicker` del listado a veces trae el recinto y a veces un pedazo de la descripción | La sede sale de `p.subtitle` del **detalle**, cortada en el separador ` I ` (que es jerarquía: "Museo … I Librería") |
| 🔴 **El sitio parte las etiquetas en dos líneas** según el ancho: `<var\nclass="atc_date_start">` | Todos los patrones aceptan cualquier espacio en blanco (`<var\s+class=`). Buscar el espacio literal hacía que `parseDetalle` devolviera **cero** eventos en esas páginas — se comía 7 de 12, en silencio, hasta el 2026-08-06 |
| 🔴 **La etiqueta a veces trae ciclo**: `agenda • Disciplina • Ciclo` | Se toma el **segundo** segmento, no el último. Con `.pop()` la "disciplina" era el nombre del ciclo — y como de ahí sale `DISCIPLINA_MUSICAL`, **un concierto dentro de un festival habría caído en `cultura`** |
| Cambio de tema del sitio = fuente muda | Revienta si **ningún** día del barrido tuvo la forma esperada, y también si **todos** los detalles responden 200 sin soltar eventos. Un detalle mudo suelto se avisa por `console.warn` |

### Notas

- **~1 de cada 5 eventos no publica recinto** y cae en el `Venue` "CONARTE (sede por
  confirmar)". Se prefirió eso a tirar el 20% del inventario.
- El barrido son ~12 peticiones de listado + N de detalle, con concurrencia limitada.
  Es un sitio de gobierno estatal sin rate limit declarado: no subir la ventana sin
  necesidad.

---

## Luma — `luma`

API del discover de `luma.com` (`api.luma.com/discover/get-paginated-events`).
**Pública, sin autenticación, JSON limpio — pero no documentada ni versionada**: es
la que consume su propio front, así que puede cambiar sin aviso.

### Cómo funciona

**9 consultas por corrida**: una por cada una de las 8 categorías de Luma, más el
feed sin filtro. Es así porque **el listado no dice a qué categoría pertenece cada
evento** (eso sólo está en el detalle, ~160 KB por evento), así que la categoría sale
de *a qué endpoint preguntaste*.

| Categoría de Luma | Va a |
|---|---|
| Arts & Culture | `cultura`, o `musica` si el título suena a concierto |
| Tech, AI, Crypto | `tecnologia` |
| Fitness, Wellness | `bienestar` |
| Climate | `tecnologia` — **provisional**, avisa |
| Food & Drink | `cultura` — **provisional**, avisa |
| *(ninguna)* | por título: música → `musica`, actividad física → `bienestar`, si no `cultura` |

- **Dedupe por `api_id`**: un evento responde en varias categorías (medido: 2 de 19
  salen en Fitness *y* Wellness).
- **Prioridad explícita** `musica > cultura > bienestar > tecnologia` para los que
  salen en varias. Sin regla, la categoría dependía del orden de los `for`.
- **La heurística de música corre sólo dentro de Arts & Culture** (Luma no tiene
  categoría de música) **y en lo que no trae categoría**. Suelta, un "Startup
  Showcase" se volvía concierto.
- **El feed sin filtro va al último** y recoge lo que Luma no clasifica (medido: 1 de
  19, un club de correr). Sin esa pasada se perdía sin dejar rastro.

**Climate y Food & Drink se piden y se mapean desde el arranque aunque hoy den cero**
en Monterrey, porque dejarlas sin destino "hasta que lleguen" significa que el día
que llegue la primera se cae sola y nadie se entera. Su destino se decidió con
muestras del feed global, así que **el conector avisa la primera vez que traigan
algo**: ése es el momento de confirmar o corregir con casos reales.

- Climate resultó ser **una industria, no un tema**: ~6 de 8 de la muestra eran
  climatetech (demo days, summits, inversión en energía), o sea un meetup de
  industria. Por eso `tecnologia`, por **contenido**, no por formato.
- Food & Drink es **el mapeo más flojo del proyecto**. Muestreado el 2026-08-06 y
  quedó **3 a 2**: catas y un mixer tiran a `cultura`; `Uncorking Value: Deals,
  Decisions & Disruption` y `Lab Ops on the Rocks` son networking de industria. No se
  cambió porque con n=5 sería cambiar una corazonada por otra, y la muestra sale de
  Boston (ciudad de biotech y VC), que empuja justo hacia el networking.

### Trampas y dónde está la defensa

| Trampa | Defensa |
|---|---|
| 🔴 **Cuatro parámetros se ignoran EN SILENCIO y devuelven 200** — parece que filtraste y estás viendo otra cosa | Los nombres correctos: `latitude`/`longitude` (no `lat`/`lng`), `discover_category_api_id`, `discover_place_api_id`, **`pagination_cursor`**. Mnemotecnia: palabras completas y prefijo `discover_` en los IDs |
| El campo de la respuesta se llama `next_cursor`, así que es el nombre natural a copiar — y mandarlo devuelve la página 1 otra vez | El parámetro es `pagination_cursor`. Además hay tope de páginas **por consulta** y corte si el cursor no avanza: sin eso, el bucle gira para siempre sobre los mismos eventos |
| 🔴 **Sin coordenadas geolocaliza POR IP, y el VPS aterriza en Boston** (42.34, −71.10). Produjo la conclusión falsa de que "Monterrey no existe en Luma" | `latitude`/`longitude` explícitos **siempre**, y el conector **revienta** si nada del barrido es de Nuevo León |
| El área es metropolitana (6 municipios), así que `geo_address_info.city` no es "monterrey" | `city: "monterrey"` fijo; el municipio real no se copia |
| **El nombre de la sede está en `address`**, no en un `place_name` — y la calle está en `short_address`. Es fácil mapearlo al revés | `venue.name` ← `address`, `venue.address` ← `short_address`, `venue.zone` ← `sublocality`. Se lee del bloque `localized.es`, que trae lo mismo en español |
| **~22% trae la sede oculta** (`mode: "obfuscated"`) | Esos eventos se **descartan**: sin nombre real colapsarían en un `Venue` falso y el dedupe fusionaría eventos sin relación |
| Un curso de varias semanas publica una sola entrada con el fin de la última sesión | Se descarta `endsAt` si dura más de 24 h: mejor sin hora de fin que con una falsa en el calendario y el ICS |
| Precios en otra moneda mostrados como "$" | Sólo se confía en MXN; `is_free` → `0` (dato real), no `undefined` |

⚠️ **El corte por Nuevo León es global, no por consulta** (a propósito): las
coordenadas se ignoran para todas por igual, así que el global detecta el mismo
fallo, y el per-consulta añadía un falso positivo real —una categoría chica que
devuelva un solo evento de Saltillo tumbaría la ingesta entera—. El **tope de
páginas** sí es por consulta.

### Pendiente

🔴 **Los términos de uso de Luma: SIN REVISAR.** Es una API interna no documentada.
Conviene leerlos antes de desplegar.

⚠️ Corregido el 2026-08-06: este párrafo decía *"esto corre a diario en prod"* y era
**falso**. `origin/main` sólo tiene `ticketmaster` y `arena-monterrey` en el registry;
CONARTE, Luma y Superboletos están commiteados en `main` local **sin pushear**, así que
el cron de producción sigue ingiriendo con dos fuentes. Verificado con
`git cat-file -e origin/main:src/lib/ingest/sources/luma.ts` (no existe).

---

## Superboletos — `superboletos`

La boletera que surte a Showcenter Complex, Dion Live Center y varios venues chicos.
Implementada el 2026-08-06; **cubrió de paso Showcenter Complex**, que estaba en la
lista de pendientes por separado.

### Cómo funciona

No se scrapea. Su front es Next.js y lee **un solo JSON en CloudFront con el catálogo
nacional completo** (1,159 eventos, 1.2 MB), sin autenticación:

```
https://dl09mj2qf37fz.cloudfront.net/SuperBoletosRepositorio/apps/jsonCache/<VER>/catalogos/search.json
```

`<VER>` es el número de build del sitio. Se resuelve en cada corrida: home →
`pages/_app-<hash>.js` → `NEXT_PUBLIC_CDN_CONTENT_VERSION`. Son **3 peticiones fijas y
cero por evento**.

Medido el 2026-08-06: 224 registros de Nuevo León, **88 vigentes**. De ésos 51 son de
Arena Monterrey (que ya traen Ticketmaster y el conector de la Arena) → **~37 netos
nuevos**, sobre todo Showcenter Complex (21) y Dion Live Center (9).

### Trampas y dónde está la defensa

| Trampa | Defensa |
|---|---|
| 🔴 **Todos los precios vienen en `0`, y aquí `0` significa "no sé"** — al revés que en CONARTE, donde es entrada libre real | `precio()` sólo deja pasar valores `> 0`. Copiarlo tal cual pintaría **toda** la cartelera como "Gratis" |
| 🔴 **El archivo es un HISTÓRICO, no una cartelera**: trae eventos desde 2013, y **108 de los 224 de NL están `CANCELADO`** | Se filtra por `claveEstatusFechaEvento === "NORMAL"` y por fecha futura. Sin eso se ingiere una década de basura |
| 🔴 **Las fechas son strings en español sin año cuando es el año en curso**, y no hay un solo campo ISO en todo el JSON | Se parsea sólo la forma canónica `DD de MES [de YYYY] HH:MM` |
| 🔴 **El formato de rango SÍ incluye eventos pasados**: `THE BOOK OF MORMON`, "Del Jue. 21 al Dom. 24 Mayo", era de mayo de 2026 y ya había ocurrido | Los rangos se **descartan** (~13 de 97). Confirmado por dos caminos: el `endDate` de su promoción MSI decía `25/05/2026`, y el 21 de mayo de 2026 cayó jueves (en 2027 cae viernes) |
| En diciembre, un anuncio de enero se leería como enero *pasado* | Si la fecha sin año cae más de 60 días atrás, se reinterpreta como del año siguiente. Con test de tiempo congelado |
| `Date.UTC(2026, 1, 31)` es el 3 de marzo: un día inexistente rueda al mes siguiente y produce una fecha plausible y falsa | Se valida que el día construido sea el pedido |
| Las fechas son *timezone-naive* en hora de Monterrey | `fechaZonaAUtc()` (movido a `src/lib/ingest/fechas.ts` al compartirlo con CONARTE). Tests bajo `TZ=UTC`, `America/Monterrey` y `Asia/Tokyo` |
| 🔴 **`claveTipoEvento` "Familiares" es un cajón de marketing**: los 12 son conciertos —Melanie Martinez, Morat, Elefante—, todos con `claveGenero: MUSICAL` | La categoría sale de **`claveGenero`**, con `claveTipoEvento` sólo de respaldo. "Familiares" queda deliberadamente sin mapear |
| La URL lleva el número de build y se vence | Las versiones viejas dan **403** (probado con 27767, 27700, 27000, 26000), así que un bump rompe **ruidosamente** en vez de servir un catálogo congelado |
| Un colapso parcial (88 → 3 porque cambió un nombre de campo) es invisible para `hayCaida()`, que sólo ve la caída a cero | El conector revienta si el catálogo nacional trae ≥100 registros pero quedan <20 vigentes en NL |

### Notas

- **El dedupe depende del nombre del venue.** `nombreRecinto` ya viene exactamente como
  "Arena Monterrey", igual que en Ticketmaster: no se toca. Cambiarlo duplicaría ~51
  eventos entre tres fuentes. Verificado en la BD: existe **un solo** `Venue` con ese
  nombre. A nivel de *evento* se colaron 2 duplicados — ver "Duplicados conocidos entre
  fuentes" arriba.
- **Los cancelados se descartan en vez de emitirse con `status: "cancelado"`**, aunque el
  tipo lo permita: `upsertEvents` **sí** actualiza `status` (a diferencia de `category`), y
  como esos eventos también los traen otras dos fuentes, el estado haría ping-pong según
  qué conector corriera al final.
- `minExpected` se deja en el default. Con ~88 eventos, ponerlo en 20 no habría hecho la
  detección más estricta —`minExpected` es un gate sobre la corrida *anterior*, no un piso
  de la actual—; el piso real vive en la aserción del conector.

### Pendiente

🔴 **Los términos de uso de Superboletos: SIN REVISAR.** Es un JSON público servido a
cualquier visitante anónimo, así que el riesgo es menor que el de Luma, pero esto correría
a diario y el repo es público. Vale la lectura.

---

## AREMA Ticket — `arema`

La boletera de los venues chicos del área metropolitana. Implementada el 2026-08-07;
**cerró de paso los dos pendientes de "fuentes sin explorar"** (ver abajo) y es la
primera fuente con masa real de comedia.

### Cómo funciona

No se scrapea. Su front es React y habla con dos endpoints JSON sin autenticación, los
dos **POST con cuerpo JSON**:

```
POST https://t3lb.arema.mx/public/events/list   {}                  → catálogo nacional
POST https://t3lb.arema.mx/public/events/get    {"event_id": 20420} → sinopsis + funciones
```

La URL salió de su bundle (`REACT_APP_API_URL` en `/static/js/main.<hash>.js`). El
listado devuelve **el catálogo nacional entero en una sola petición, sin paginar** (648
eventos al 2026-08-07, 96 de ellos en Nuevo León) — no hace falta resolver un número de
build como en Superboletos.

**Por qué hay etapa 2:** el listado trae **una sola fecha por evento**, la primera
función, aunque la obra tenga temporada. En la muestra del reconocimiento 6 de 14 tenían
más de una y "Gran Feria Nuevo León" tiene 10. Con la etapa 2, los 96 del listado se
vuelven **~143 funciones**; sin ella se publicaría el estreno y se perdería el resto. Son
96 peticiones extra, en tandas de 4 (regla 6). Corrida completa: **3.8 s**.

También existe `https://search.arema.io/events?q=<texto>&c=<n>`, que es lo que usa su
buscador. **No se usa**: topa en 50 resultados por consulta y obligaría a inventar
términos de búsqueda para barrer el estado. Sirvió sólo para el reconocimiento.

### Trampas y dónde está la defensa

| Trampa | Defensa |
|---|---|
| 🔴 **La API responde HTTP 200 aunque falle**; el error va en el cuerpo (`{"error":true,"code":"UNXEND"}` para un endpoint que ya no existe) | `post()` mira `error` y `data`, no sólo el status. Confiar en el status apagaría la fuente en silencio, justo lo que prohíbe la regla 1 |
| 🔴 **`Pabellon M` es el `Escenario GNP Seguros` de Ticketmaster** (mismo recinto, Av. Benito Juárez 1002), y `Teatro de la Ciudad de Monterrey` es el `Teatro de la Ciudad` de TM y CONARTE | `ALIAS_VENUE`, por nombre **exacto**. Con regex o "parecido", `Teatro de la Ciudad San Nicolás` —que es otro teatro, en otro municipio— se fusionaría con el del centro |
| 🔴 **`poster` viene `null` en los 96 de NL**, pero la imagen sí existe | Se deriva del id: `cdn.arema.dev/t3/events/<id>/800.webp`. Comprobado 200 en los 96, incluido el único que la búsqueda no devolvía |
| **Funciones canceladas** dentro de la temporada (`active: false`) y funciones ya pasadas de una obra que sigue en cartel | Se filtran por `active` y por fecha, función por función, no por evento |
| Si el detalle de un evento falla, se perdería el evento entero | Cae a la fecha del listado y avisa por `console.warn`. Degradar es mejor que perderlo |

### Notas

- **`date` es epoch en SEGUNDOS y en UTC de verdad** — `1786104000` es las 20:00 en
  Monterrey. Es la primera fuente que **no** necesita `fechaZonaAUtc`: las de CONARTE y
  Superboletos son *timezone-naive* y hay que interpretarlas; ésta no. El test lo verifica
  bajo tres zonas horarias para que nadie "arregle" esto con un `new Date(naive)` que
  pasaría en prod (que corre en `America/Monterrey`) y fallaría en local.
- **Lo desconocido cae en `cultura`, no en `musica`** — al revés que Superboletos. Aquí la
  música tiene etiqueta propia y sin ambigüedad (`Concierto`), así que una categoría que no
  reconocemos casi nunca es un concierto. `Especiales` y `Familiares` son cajones de
  marketing (un rodeo, un drag tour, una feria) y por eso van a `cultura`.
- **No trae precio.** El listado no lo incluye y el detalle tampoco; estaría en el checkout,
  a una petición más por evento. Se deja `undefined`, que es "no sé" — no `0` (regla 4).
- Los títulos se dejan **tal cual**, con su " en Monterrey" incluido. Estorba un poco en la
  UI, pero recortarlo es tocar la única cuerda de la que cuelga el dedupe.

### Pendiente

🔴 **Los términos de uso de AREMA: SIN REVISAR**, igual que los de Luma y Superboletos.

---

## Fever — `fever`

La única fuente que **no** es boletera de conciertos: Candlelight (a la luz de velas, en
el Museo de Historia Mexicana), experiencias inmersivas, museos, juegos callejeros y
cena-espectáculo. Implementada el 2026-08-07. **Cero solape con las demás**: no comparte
ni un venue con ninguna otra fuente, medido sobre la BD dev.

Rinde **~56 eventos de 34 planes publicables** — de los 49 que trae la home, 13 son
tarjetas de regalo o entradas sin fecha (`isTimeless`) y 2 son de otra ciudad.

### Cómo funciona

Dos etapas, y la segunda **no es opcional**:

```
GET https://feverup.com/es/monterrey   → sólo la LISTA de ids (49 planes)
GET https://feverup.com/m/<planId>     → el plan de verdad: ciudad, sede y FUNCIONES
```

1. **La home es Astro.** Cada tarjeta es una isla cuyo `props` trae el plan en JSON
   escapado como HTML y con **cada valor envuelto en una tupla `[0, valor]`** (`[1, …]`
   para arreglos), que hay que desenvolver recursivamente. De aquí se usa sólo el `id` —
   y `isTimeless`, para ahorrarse 13 peticiones de planes que se iban a descartar.
2. **La página del plan tiene todo en un `<script id="astro-tools-transfer-state">`**, que
   es **JSON limpio**: sin tuplas y sin entidades. Adentro:
   - `page-config.planDetail` → `citySlug`, `defaultPlace` (nombre **y dirección**),
     `categories`, `description`, `coverImage`, `priceInfo`, `isTimeless`,
     `isCalendarSelector`, `firstActiveSessionDate`.
   - `ticket-selector-config.transferState` → **las funciones reales**, en el árbol del
     selector de boletos.

**Por qué hace falta la etapa 2:** en la home `startDate`/`endDate` son un **rango** ("El
Laberinto de Tim Burton", del 6 al 16 de agosto, es un solo plan), no una función.
Publicando el rango, el evento saldría el día del estreno y desaparecería el resto de la
corrida. Son 36 peticiones extra en tandas de 4 (regla 6); la corrida completa tarda ~40 s.

**El selector de boletos viene en dos formas**, y el conector las trata distinto:

| Forma | Quién la usa | Qué se publica |
|---|---|---|
| `LevelTicketSelectorLoader.getPlanSessionsForPlace` — árbol `fecha → hora → sesión` con `starts_at_iso`, `ends_at_iso`, `price` y `has_available_tickets` | Funciones sueltas: los Candlelight, The Jury Experience, el Jazz Room | **Un evento por día**, con la primera función del día y el precio más barato/caro de sus zonas |
| `PlanCalendarSelectorService.getCalendarAvailability` — mapa `YYYY-MM-DD → {status, minTicketPrice}`, más un `getPlanSessionsForPlaceAndDate` precargado para el primer día | Corridas continuas: museos, exposiciones, juegos callejeros (`isCalendarSelector: true`) | **UN solo evento**, en el próximo día disponible. Como la ingesta corre a diario, la fecha se recorre sola |

Lo que **no** se usa: `data-search.apigw.feverup.com` existe pero es una FastAPI
autenticada (`/docs` → 401). Y `/es/monterrey/<categoria>` (Angular SSR, otro stack por
completo) sólo aportaba 4 planes que la home no tiene y ninguna fecha que la etapa 2 no dé
mejor. `robots.txt` permite las dos rutas que sí se usan.

### Trampas y dónde está la defensa

| Trampa | Defensa |
|---|---|
| 🔴 **13 de los 49 planes de la home no son eventos**: tarjetas de regalo disfrazadas de plan (con fecha `2030-01-01`) y entradas sin fecha fija | `isTimeless`, que las marca a todas. De paso desaparece el problema de `Localización Secreta Monterrey` (12 planes), que no es un venue sino "no te decimos la sede hasta que compres": era la sede de las tarjetas |
| 🔴 **Se cuelan planes de otra ciudad** en la home de Monterrey (Ricardo Arjona en Aguascalientes, el PGA Tour en Vallarta) — y la home los lista con el **nombre de su recinto**, así que ahí no se distinguen | `planDetail.citySlug !== "monterrey"` en la etapa 2. Filtrar por nombre de sede sería una lista negra que envejece |
| 🔴 **`startDate`/`endDate` de la home son un RANGO, no una función** | Toda la etapa 2 existe por esto |
| 🔴 **Un plan que corre a diario inundaba la cartelera**: el "City Tour Hop On/Hop Off" publicaba 10 renglones idénticos | Más de `MAX_DIAS_SUELTOS` (6) días distintos ⇒ se trata como corrida continua y sale uno solo. Los Candlelight, que sí queremos expandir, no pasan de 3 fechas; el Jazz Room, de 4 |
| **Días agotados**: "La Odisea IMAX" tiene `sold_out` las dos primeras semanas, y su primer día real es el 22 | Se saltan los `status: "sold_out"`. Ojo: `"low"` es "quedan pocos", **no** "no hay" |
| **`type: "waitlist"`** — el LIV Golf 2027 no es un evento, es apuntarse a una lista | Sólo se publica `type: "standard"` |
| Un plan cuyo detalle no se puede leer | Se cuenta y se avisa por `console.warn`; si fallan **todos**, revienta (regla 1) |
| La home responde 200 aunque cambie el markup | Cero islas ⇒ error. Y si la home viene sana (≥30 planes) pero salen <15 eventos, también: ése es el colapso parcial que `hayCaida()` no ve |

### Notas

- **Fever no manda categoría en el plan de la home**; sí en el detalle, con **su** taxonomía
  (regla 3): `category` (`concert`, `nightlife`, `cinema`, `theater`, `tourism`, `mix`,
  `sport`) y `categories`, una lista larga en inglés. `nightlife` **no es fiesta**: es donde
  meten los Candlelight, así que va a `musica`. `mix` es su cajón de sastre y va a `cultura`.
  8 de los 49 traen `category` vacía —cuatro de ellos Candlelight—, y por eso hay un segundo
  intento sobre `categories` antes de caer en `cultura`.
- **Las fechas traen offset** (`2026-09-26T19:00:00-06:00`), así que no necesitan
  `fechaZonaAUtc`. La única que sí es el día del calendario de un plan de temporada
  (`YYYY-MM-DD` + una hora suelta); el test lo verifica bajo tres zonas horarias.
- **El precio es un "desde"** (la zona más barata, sin cargo por servicio) y va en
  `priceMin`. `priceMax` sólo se pone cuando el día tiene varias zonas con precios
  distintos: es el boleto más caro de esa función, no una invención.
- **`tags: []` a propósito.** Las `categories` de Fever son etiquetas en inglés
  ("Scavenger Hunt", "Small Gig") y el matcher del digest las compararía con texto libre en
  español: no le sirven de nada.
- **La descripción se recorta a ~500 caracteres**, cortando en la última frase que quepa:
  el copy de Fever son 2 000+ caracteres de marketing con emojis, y la ficha del evento lo
  pinta como un solo párrafo.
- **Las funciones que trae el selector son las que la página precarga**, no necesariamente
  la temporada completa. Alcanza de sobra para el horizonte de 10 días del digest, y se
  refresca a diario.

### Pendiente

- 🔴 **Los términos de uso de Fever: SIN REVISAR**, igual que los de Luma, Superboletos y
  AREMA.
- 🟡 El endpoint que hay detrás de `getPlanSessionsForPlace` no se buscó (la versión
  precargada alcanza). Si algún día hace falta la temporada completa de un plan, ahí está
  el hilo.

---

## Fuentes sin explorar

**Ninguna pendiente.** Los dos que quedaban se cerraron el 2026-08-07, y ninguno necesitó
conector propio:

- **Auditorio Pabellón M** — ya entraba. Ticketmaster lo trae como **Escenario GNP
  Seguros** (43 eventos en prod), que es su nombre nuevo; se reconoció por la dirección.
  Su sitio propio (`auditoriopabellonm.com`) está muerto: redirige a `/lander`.
- **Teatro de la Ciudad** — lo administra CONARTE, así que su programación gratuita ya
  entra por ese conector (6 de sus 19 eventos el 2026-08-07). Lo de paga entra por Arema
  y por Ticketmaster. No tiene cartelera propia.

Showcenter Complex y Superboletos salieron de la lista el 2026-08-06 — el conector de
Superboletos cubrió los dos de una vez.

Auditorio Citibanamex se quitó el 2026-07-23: Ticketmaster ya cubre ese venue
("Auditorio Banamex") y el `pageConnector` sólo vivía de un fallback por LLM que
nunca tuvo `ANTHROPIC_API_KEY`.

### Boletia: cerrado (investigado el 2026-08-07)

Su CloudFront responde **403 "Request blocked" a todo** —portada, `/eventos`, `/api/v1/…`
y hasta `robots.txt`—, tanto con nuestro User-Agent como con uno de navegador. También
responde 403 desde infraestructura ajena a este VPS, así que **no es nuestra IP**:
bloquean clientes no-navegador en general. `api.boletia.com` resuelve (`3.92.2.169`) pero
ni siquiera acepta la conexión: timeout. Sin un acuerdo con ellos no hay ruta que no sea
evadir su WAF, y eso no se hace en un cron diario con el repo público.

### Fever: implementada el 2026-08-07 — su ficha está arriba

Se reconoció y se documentó aquí el 2026-08-07 sin escribir el conector; ese mismo día,
después, se implementó. La ficha viva es **"Fever — `fever`"**, más arriba; lo que decía
esta sección y ya no vale la pena repetir queda en el historial de git.

Dos cosas de aquel reconocimiento resultaron ser **incompletas**, y conviene saberlo
porque nacieron de mirar sólo la home:

- Decía que las fechas por función sólo estaban en el renderizado Angular
  (`/es/monterrey/<categoria>`). **No**: están en la página de cada plan, en el
  `astro-tools-transfer-state`, junto con la sede, la ciudad y el precio. El renderizado
  Angular no se usa.
- Decía que la ciudad había que adivinarla por el nombre de la sede. **No**: el detalle
  trae `citySlug`.

### Facebook e Instagram: descartados (investigado el 2026-08-06)

No es cuestión de esfuerzo, el camino está cerrado por diseño de Meta:

- **Facebook.** La doc del objeto Event dice textual: *"Access to Events on Users and
  Pages is only available to Facebook Marketing Partners."* Eso es un programa de
  partnership comercial, no un app review que se apruebe con paciencia. Sin él el
  endpoint no existe para nuestra app, con cualquier token.
- **Instagram.** No tiene concepto de evento. La Graph API sirve para administrar *tu
  propia* cuenta business/creator. El único acceso a contenido ajeno es *Instagram Public
  Content Access* — búsqueda por hashtag, también gated, y devolvería captions de texto
  libre sin fecha, sede ni precio.
- Scrapearlos violaría los ToS de forma explícita, correría a diario en prod y el repo es
  público. No compensa.
- **Eventbrite**, la siguiente suposición natural, también está cerrado: retiraron el
  acceso público a `GET /v3/events/search/` en diciembre de 2019.

La idea no era mala —los venues chicos de Monterrey sí publican primero en Instagram—,
pero no hay ruta técnica legítima.

## Panorama competitivo

Investigado el 2026-08-05, por si sirve para priorizar:

- **Tudu.app** (`tudu.app/monterrey`) — el clon más cercano de nuestra mitad web, ya
  con apps nativas. Agrega Boletia + Arema + Fever. Cuando se escribió esto los catálogos
  eran casi complementarios; desde el 2026-08-07 nosotros también traemos Arema y Fever,
  así que lo único suyo que no tenemos es Boletia (cerrado para nosotros) y lo único
  nuestro que no tiene es Ticketmaster, CONARTE, Luma, Superboletos y la Arena. Su
  debilidad no cambió: es un sitio pasivo de navegación, sin push ni suscripción.
- **Monterrey Secreto** — el incumbente editorial local, y **no es independiente**:
  sirve assets desde `offloadmedia.feverup.com`, es parte de Secret Media Network
  (ligada a Fever). Distribuye por email.
- **Fever** — promotor además de agregador (vende sus propios *Originals*), no es
  neutral.
- **AllEvents / Bandsintown / Songkick / DICE** — generalistas globales o sólo música.

**Nadie de ese grupo entrega por WhatsApp**, que sigue siendo el diferenciador real;
la cartelera en sí ya es commodity y Tudu la tiene mejor. Salvedad honesta: no
encontrar un competidor WhatsApp-native no prueba que no exista — la difusión por
WhatsApp es invisible a los buscadores por naturaleza.
