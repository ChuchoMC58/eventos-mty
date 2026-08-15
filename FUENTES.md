# Fuentes de eventos — cómo están implementadas

> Un solo documento para las diez fuentes. **Sustituye a `FUENTE-CONARTE.md` y
> `FUENTE-LUMA.md`** (borrados el 2026-08-06 al consolidar; los reportes de
> reconocimiento completos —con los apéndices de curl y las mediciones crudas—
> siguen en el historial de git y se recuperan con
> `git show 88f6b70:FUENTE-LUMA.md` / `git show 88f6b70:FUENTE-CONARTE.md`
> (`88f6b70` es el último commit en que existían; verificado).
>
> Esto describe **lo que está implementado hoy** y por qué está escrito así. La
> narrativa por sesiones vive en `HANDOFF.md`; aquí sólo lo que sigue siendo cierto.
>
> Última revisión: 2026-08-13.

## De un vistazo

| Fuente | slug | Cómo se obtiene | Rinde | `minExpected` | Qué aporta que las demás no |
|---|---|---|---|---|---|
| Ticketmaster MX | `ticketmaster` | API oficial con llave | ~127 | 5 (default) | El grueso del volumen: conciertos, teatro con boleto y **el fútbol de Rayados** |
| Arena Monterrey | `arena-monterrey` | API JSON no documentada de su sitio | ~49 | 5 (default) | Lo que vende Superboletos en ese venue, que Ticketmaster casi no trae |
| CONARTE | `conarte` | Scraping de HTML, 2 etapas | ~12 | 2 | Cultura pública y **gratuita**: nadie la vende, así que ninguna boletera la tiene |
| Luma | `luma` | API interna de su discover | ~16 | 2 | Meetups, venues chicos, tech y bienestar autogestionados |
| Superboletos | `superboletos` | JSON del catálogo en su CDN | ~88 | 5 (default) | Showcenter Complex y Dion Live Center, que ninguna otra fuente ve |
| AREMA Ticket | `arema` | API JSON no documentada, 2 etapas | ~143 | 5 (default) | Los venues chicos del área metro (Río 70, Café Iguana, Dramático) y la única masa de comedia |
| Fever | `fever` | Ids del HTML + su API REST, 2 etapas | ~56 | 5 (default) | Lo que no es boletera: Candlelight, museos, experiencias inmersivas y juegos callejeros |
| Tigres UANL | `tigres` | API JSON de un componente de terceros, 2 etapas | ~7 | 2 | El otro equipo de la ciudad: no está en Ticketmaster **en absoluto** |
| MARCO | `marco` | Scraping de HTML + ruta REST del tema | ~5 | 2 | El museo privado grande: talleres y domingos familiares que no vende ninguna boletera |
| Cultura UANL | `cultura-uanl` | REST API del plugin *The Events Calendar* | ~12 | 2 | La cultura de la universidad pública, casi toda gratis: Colegio Civil CCU, Sala Fósforo, Capilla Alfonsina |

Registro de conectores: `src/lib/ingest/registry.ts`. **Agregar una fuente es
agregar una entrada ahí.** La ingesta corre 1×/día por cron (`0 12 * * *` UTC =
06:00 MTY).

✅ **Fever estuvo rota y se arregló el 2026-08-13**: había migrado las páginas de plan
de Astro a **Angular** y el `<script id="astro-tools-transfer-state">` del que colgaba
toda la etapa 2 dejó de existir. La etapa 2 ya no lee el HTML de esa página: usa la
**API REST** que llama ese mismo Angular. Detalle abajo, en su ficha.

## Ver en la cartelera qué trae una fuente: `?fuente=<slug>`

La cartelera acepta **`?fuente=`** con el slug del conector, y se combina con todos los
demás filtros. **No tiene chip en la UI a propósito** (`src/app/page.tsx`): es para
revisarle el trabajo a una fuente después de una ingesta, no un filtro que le sirva al
público, que no sabe ni le importa de dónde sale cada evento.

```
/?fuente=fever                      qué tiene Fever en la BD, mes por mes
/?fuente=fever&mes=2026-10          otro mes (la vista arranca en el actual)
/?fuente=arema&categoria=musica     cruzado con cualquier otro filtro
/?fuente=tigres&fecha=finde
```

Dos cosas que conviene tener claras al usarlo para revisar:

- **Enseña lo que la fuente tiene en la BD, no lo que trajo la última corrida.** Una
  fuente que deja de listar un evento no lo borra, y **la fila no se va nunca**: deja de
  *verse* cuando su fecha pasa, porque la vista pide `startsAt >= ahora`. No es limpieza,
  es que se sale de la ventana — ver § "La ingesta sólo agrega" abajo. Después de arreglar
  Fever quedaron ~10 filas de la corrida anterior (La Odisea IMAX repetida en su día
  viejo). Si lo que quieres es "qué trajo hoy", eso lo dice la ingesta, no la cartelera.
- **La vista por defecto es el mes en curso**, así que el número de arriba nunca es el
  total de la fuente. Fever son ~56 eventos repartidos en cuatro meses.

Los slugs son los del registro: `ticketmaster`, `arena-monterrey`, `conarte`, `luma`,
`superboletos`, `arema`, `fever`, `tigres`, `marco`, `cultura-uanl`.

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

**8. Antes de asumir scraping, búscale la API interna.** Cinco de las diez fuentes
la tenían (Arena, Luma, Superboletos, AREMA, Tigres) y ninguna está documentada. La
receta, en orden de esfuerzo:

⚠️ **Y antes de escribir un parser de HTML, mira qué plugin usa el WordPress.** El
paso 2 de abajo dice "busca `ld+json`"; hay un escalón anterior más rentable. Cultura
UANL usa **The Events Calendar**, que expone su propia REST API —documentada,
versionada, con sede, hora y costo— en `/wp-json/tribe/events/v1/events`. Es la ruta
más limpia de todo el proyecto y se habría perdido si "WordPress" se hubiera dado por
sinónimo de "hay que scrapear": la REST API **estándar** de WordPress ya había
resultado inútil dos veces (CONARTE y MARCO: `acf` vacío, `date` = fecha de
publicación), y esa mala experiencia es justo lo que empuja a saltarse la
comprobación. Se reconoce por la URL de los eventos (`/actividad/…`, `/event/…`) y
por que exista `…/wp-json/tribe/events/v1/events`.

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
   ⚠️ **A veces el bundle no la tiene.** La de **Tigres** no está como literal en
   ningún lado: su calendario lo pinta un componente de terceros y la URL viaja
   como **atributo del elemento** en el HTML. Ahí el único camino es cargar la
   página en Chrome por CDP y anotar las peticiones (`Network.requestWillBeSent`),
   que es lo que la destapó. Ver AGENTS.md § "Screenshots y pruebas de UI".
   ⚠️ Y si la config viaja en atributos, **acepta espacios alrededor del `=`**:
   los de Tigres vienen como `edition = "…"` y un patrón normal no los encuentra.
   ⚠️ **Y a veces la red tampoco la tiene**, que es el caso contrario: una página
   con SSR no vuelve a pedir lo que ya trae puesto, así que el trazado con CDP sale
   **vacío**. Fever es así, y lo que la destapó fue bajar los ~220 chunks del bundle
   y grepearlos por el **nombre de la clave del estado precargado** —el `serverApp-state`
   de Angular usa como clave el nombre del método (`getPlanSessionsForPlaceAndDate`)—,
   que aparece junto a la plantilla de URL. La versión de la API iba aparte, en un
   `getApiBaseUrl("4.4")` de otro chunk.
4. Medir cuántas peticiones cuesta una corrida completa **antes** de escribir el
   conector. Superboletos son 3 fijas; AREMA, 1 + una por evento; Tigres, 2 fijas;
   Fever, 1 + dos o tres por plan.

⚠️ Dos cosas que la receta no decide: si la fuente **bloquea clientes no-navegador**
(Boletia da 403 hasta a su `robots.txt`), ahí se acaba el camino — no se evade. Y los
**términos de uso** hay que leerlos aparte: los de Luma, Superboletos y AREMA siguen
sin revisar.

**9. Un 403 con nuestro User-Agent no prueba nada. Repetir con uno de navegador.**
Son dos cosas distintas y se parecen: un **WAF que filtra clientes no-navegador**
(bloquea igual a Chrome que a nosotros → cerrada de verdad) y un **filtro de
User-Agent** (nos rechaza a nosotros y deja pasar a Chrome → la fuente está viva y lo
que hay es una decisión que tomar sobre la regla 6). El 2026-08-13 se dio **Sultanes**
por cerrada durante media sesión por saltarse esta comprobación: da 403 a nuestro UA
y **200** a uno de navegador. El reconocimiento de Boletia sí hizo la doble prueba en
su día, y por eso ese veredicto sigue en pie. Mientras se está en ello, mirar también
el `robots.txt`: Resident Advisor nos bloquea por infraestructura pero **nos permite
por escrito**, y esa diferencia importa para decidir.

---

## La ingesta sólo agrega: un evento que desaparece de su fuente se queda publicado

Medido el 2026-08-14. **No es un bug de una fuente, es cómo está hecho el modelo**, y
conviene entenderlo antes de tocar `upsertEvents` o de diagnosticar "por qué sale esto en
la cartelera".

### Los tres hechos

1. **`upsertEvents` sólo agrega y actualiza; nunca quita.** Recorre lo que la fuente trajo
   hoy y hace insert o update de cada uno. **Lo que la fuente dejó de traer, ni se mira**:
   nadie le pregunta "¿y los que me diste ayer y hoy no?".
2. **Nada borra eventos, nunca.** El único `deleteMany` del repo es de `SavedEvent`, cuando
   el usuario quita un "Me interesa". Al 2026-08-14 la tabla tenía 578 filas, **90 de ellas
   ya pasadas**, la más vieja del 6 de agosto.
3. **Sólo 2 de las 10 fuentes pueden marcar una cancelación**: `ticketmaster`
   (`dates.status.code`) y `tigres`. Las otras ocho escriben `status: "activo"` a fuerza, y
   está comentado en su código — `conarte.ts` *"el sitio no expone cancelaciones"*,
   `fever.ts` *"un plan cancelado desaparece"*.

### La consecuencia

En esas ocho fuentes **una cancelación se ve como el evento desapareciendo del listado**, y
del lado nuestro no pasa nada: la fila se queda en `"activo"` y **se sigue publicando hasta
que su fecha pasa**. No se apaga porque alguien lo resolvió, sino porque salió de la
ventana que consulta la vista.

Cuanto más lejos la fecha, más aguanta: un evento cancelado con tres meses de anticipación
se publica tres meses.

Lo que **sí** funciona es el otro camino: cuando la fuente dice "cancelado", el flujo está
completo y `status` se respeta en los cuatro lados — cartelera (`src/app/page.tsx`), digest
(`src/lib/digest/run.ts`), recordatorios (`src/lib/reminders/run.ts`) y `/mis-eventos`, que
sí lo enseña pero **marcado**, a propósito: si lo guardaste, quieres enterarte.

### Cómo medir cuántos hay ahora

El dato ya existe: `EventSource.lastSeenAt` se actualiza en cada corrida. Un evento futuro
cuyo `lastSeenAt` es anterior a la última corrida **OK de su propia fuente** es un huérfano.
Comparar contra "hace N días" da un número falso, porque cada fuente corre a su ritmo.

```sql
WITH ult AS (SELECT s.id, s.slug, max(sr."ranAt") ultima FROM "Source" s
  JOIN "SourceRun" sr ON sr."sourceId"=s.id AND sr.ok GROUP BY 1,2)
SELECT u.slug, e.title, e.status, e."startsAt", es."lastSeenAt", u.ultima
FROM ult u JOIN "EventSource" es ON es."sourceId"=u.id JOIN "Event" e ON e.id=es."eventId"
WHERE e."startsAt" > now() AND es."lastSeenAt" < u.ultima - interval '1 hour';
```

Al 2026-08-14 daba **3**, y sirven de ejemplo de que el número no es alarmante pero tampoco
cero:

| Fuente | Evento | Fecha | Visto por última vez | Última corrida |
|---|---|---|---|---|
| superboletos | MICHALE GRAVES 2026 | **15 ago** | 7 ago | 13 ago |
| fever | La Odisea IMAX - Subtitulada | 22 ago | 7 ago | 13 ago |
| fever | Misión Rescate Monterrey | **15 ago** | 13 ago 17:12 | 13 ago 23:04 |

Superboletos dejó de listar "MICHALE GRAVES 2026" el **7 de agosto**, corrió bien varias
veces desde entonces, y el evento seguía publicado como activo para el día siguiente.

### Por qué no está arreglado (todavía)

La corrección obvia —marcar lo que no se vio— es justo donde está el peligro: hay que
distinguir **"la fuente se rompió"** de **"el evento se canceló"**, y confundirlas vacía la
cartelera por un error de red. `hayCaida()` ya hace esa distinción para alertar, así que el
apagado tendría que colgar de una corrida **sana**, no de cualquier corrida. Tampoco es
gratis decidir si se marca `cancelado` (que es una afirmación que la fuente no hizo) o si se
esconde por otra vía.

Y hay un tercer caso que no es cancelación: un evento puede desaparecer del listado porque
**se agotó** o porque la fuente lo movió de sección. Los tres se ven idénticos desde aquí.

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

**Lo que agregó el arreglo geográfico de Ticketmaster (medido el 2026-08-13, corriendo
las 7 fuentes en memoria): ningún duplicado.** Los dos venues que entraron —Foro Corona
Monterrey (33 eventos) y Estadio BBVA (5)— **no los tiene ninguna otra fuente**, así que
no hay choque de venue + día que revisar. El único par mismo-venue/mismo-día entre
Ticketmaster y otra fuente sigue siendo `Nach` / `Jedicon en Monterrey` en el Escenario
GNP Seguros, que ya está documentado arriba como un no-duplicado correcto.

**Lo que agregaron Tigres y MARCO (medido el 2026-08-13 con las 9 fuentes en memoria):
ningún duplicado, por construcción.** `Estadio Universitario` y `MARCO` son venues
**exclusivos** de su fuente —ninguna otra tiene un solo evento en ninguno de los dos—,
así que no hay choque de venue + día que revisar. Los venues compartidos siguen siendo
los seis de siempre: Escenario GNP Seguros, Café Iguana y Auditorio Luis Elizondo
(ticketmaster + arema), Arena Monterrey (arena-monterrey + superboletos), y Teatro del
Centro de las Artes y Teatro de la Ciudad (conarte + arema).

**Lo que agregó Cultura UANL (medido el 2026-08-13 contra la BD dev): ningún
duplicado.** Sus 12 eventos caen en 5 sedes; cuatro de ellas no tienen un solo evento
de otra fuente, y en la quinta —`Aula Magna Colegio Civil`, donde AREMA sí vende— no
hay ni un par mismo-día que revisar. Ese cero **no es casualidad y no lo será mañana**:
depende de `ALIAS_VENUE`, que renombra dos sedes suyas a como ya las tenía AREMA. Sin
ese renombre no habría "cero duplicados" sino "cero duplicados **detectables**", que es
peor — el dedupe vería dos recintos distintos y dejaría pasar los dos eventos.

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

API oficial de Discovery, con `TICKETMASTER_API_KEY`. Se pregunta por
**geohash + radio** (`geoPoint=9u8djk053&radius=30&unit=km&countryCode=MX`),
paginado. Es la fuente de mayor volumen y la única con contrato estable.

### 🔴 `city=Monterrey` se comía un tercio de la fuente (arreglado el 2026-08-13)

La consulta era `city=Monterrey&countryCode=MX&size=100`, y **Monterrey es un área
metropolitana**: para Ticketmaster el Estadio BBVA está en *Guadalupe* y el Foro
Corona en *"Col. Centro Monterrey"*, que son ciudades distintas. Medido con la llave
de prod, la consulta por ciudad devolvía **90 de 131** eventos:

| Venue que se perdía | Eventos | Qué había ahí |
|---|---|---|
| Foro Corona Monterrey | 34 | un venue entero, invisible desde el día uno |
| Estadio BBVA | 5 | **Rayados** y tres fechas de **Karol G** |
| Parque Diego Rivera | 2 | los dos `Miscellaneous`, se descartan igual |

Por eso este documento decía que la consulta traía "0 eventos de `Sports`" y que
"Rayados y Sultanes no entran": era cierto, pero la causa no era el deporte sino la
geografía. **La consulta por geohash es un superconjunto estricto** de la vieja —
verificado por id: 0 eventos que estuvieran sólo en la consulta por ciudad.

Detalles que valen para no repetir el error:

- **El radio de 30 km ya cubre todo**: con 50 km sale exactamente el mismo conjunto,
  y lo siguiente que habría es Saltillo, a 85 km. El geohash es la Macroplaza.
- **Se pagina de verdad.** La consulta vieja pedía `size=100` y traía 90 de 90:
  estaba a diez eventos de truncarse en silencio, y `hayCaida()` no ve una
  truncadura —el conteo se queda alto—.
- **El conector revienta si >20% de los eventos no son de Nuevo León.** Esta API
  responde 200 aunque un parámetro no le guste (la misma trampa que Luma), y el
  filtro geográfico es lo único que nos separa del catálogo nacional.
- **Tigres y Sultanes no están en Ticketmaster**, y eso no lo arregla la geografía:
  consultados por `venueId`, el Estadio Universitario (los dos que existen en el
  catálogo) y la Explanada Sultanes dan **0 eventos**. Venden por otro lado.

**Sólo se mapean 3 segmentos** (`Music` → `musica`, `Sports` → `deportes`,
`Arts & Theatre` → `cultura`). Todo lo demás se descarta.

- **Medido el 2026-08-13 con la llave de prod: son 4 de 131**, todos
  `Miscellaneous`. Antes eran 2 de 89, y uno ni siquiera era un evento (`Superarte
  JQ & LT M&G UPGRADE (Boleto de evento no incluido)`, un meet & greet que se vende
  aparte). El mapa sigue bien.
- Ese descarte **antes era mudo**. Ahora el conector avisa con el conteo por
  segmento, para que un día en que Ticketmaster mueva las cosas de segmento se vea.

⚠️ **`Abono Rayados 2026-2027` entra como evento y se deja pasar a propósito.** Es un
abono de temporada, no un evento; cae en `deportes`, con fecha 2027-07-31. Se
consideró filtrarlo y no hay forma que no envejezca: por `status: offsale` se irían
también dos conciertos reales que hoy están offsale (Caloncho, Avatar), y por nombre
sería una lista negra. Es el mismo caso que los add-ons de boletera que
["no son duplicados"](#duplicados-conocidos-entre-fuentes) y que este documento ya
decide no "arreglar".

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
- **El precio y la dirección salen de la sinopsis, no de un campo** (ver abajo). Ningún
  endpoint suyo los expone; el precio "de verdad" estaría en el checkout, a una petición
  más por evento.
- Los títulos se dejan **tal cual**, con su " en Monterrey" incluido. Estorba un poco en la
  UI, pero recortarlo es tocar la única cuerda de la que cuelga el dedupe.

### La sinopsis es una ficha, y ahí están el precio y la dirección (2026-08-14)

Su `sinopsis` **no es prosa**: es una ficha con el mismo formato en **114 de las 115**
distintas que había en la BD, y trae los dos datos que ningún campo de su API expone.

```
**Fecha:** 05 de Septiembre 2026        ← ya lo da `dates[]` en epoch: NO se parsea
**Hora:** 21:00 horas                   ← idem
**Lugar:** Auditorio Rio 70             ← ya lo da `venue_name`
**Dirección del evento:** Serafín Peña 1051, Centro, 64000 Monterrey, N.L.   ← ✅ se lee
**Zonas y Precios:**                                                          ← ✅ se lee
• Vip: $500
• General: $300
(Precios más cargos por servicio)
**Puntos de venta oficiales:**          ← aquí terminan los precios
- Museo del Noreste (MUNE): Dr. José Ma. Coss 445, Centro, 64000 Monterrey, N.L.
```

Antes de esto, **147 de los 150 eventos de AREMA se publicaban sin precio** (los tres que
lo tenían venían de otra fuente por dedupe) y **35 de sus 39 recintos sin dirección**. Con
`parseFicha()`, el 100% de los vigentes tiene precio y todos los que traen la línea tienen
dirección.

**Sólo se leen precio y dirección.** La fecha y la hora **no se tocan**: `dates[]` ya las da
en epoch y son correctas. Reparsear texto en español para pisar un dato estructurado que ya
está bien sólo agrega maneras de romperlo — y la ficha las escribe en formatos que ni
siquiera coinciden entre sí ("Del Viernes 17 de Julio al Domingo 16 de Agosto").

| Trampa de la ficha | Defensa |
|---|---|
| 🔴 **`Puntos de venta oficiales` es una lista de direcciones con números y códigos postales.** Barrer la sinopsis entera buscando `$` no la toca, pero cualquier regla más laxa sí | El bloque de precios se corta en el primer encabezado de la sección siguiente (`Puntos de venta`, `Sinopsis`, `Elenco`, `IMPORTANTE`…). Medido sobre las 115 reales: **cero** cifras con `$` fuera del bloque |
| 🔴 **Una mesa de 6 a $2,700 no es un evento de $2,700**: son $450 por cabeza, y publicar el total lo saca de cualquier filtro de precio | Se publica el precio **por persona**: gana lo que la ficha desglose (`$1,800 ($450 por Persona)`), si no divide el cupo de la línea (`Dúo: $499 (2px)` → 250) |
| **Un precio de grupo sin cupo** (`Palco Rojo: $2,500` en un estadio: ¿el palco o el asiento?) | Se descarta la línea. Inflar el máximo con una cifra que nadie paga por entrar solo es peor que ignorarla |
| **Cifras sin `$`** (`General (día del evento): 1,100`) | No se adivinan: sin el signo no se distinguen de un código postal, una hora o un año. Se pierde algún máximo; ninguno de los mínimos |
| Fichas en prosa, sin encabezados (el rodeo del Montana Bull: `$450 grada / $600 silla numerada`) | Sin encabezado de precios se arranca en la primera línea con `$`. Rinde el rango correcto |

Las 3 sinopsis sin precio y sin dirección **no los traen**: no es que el parser falle.

### Pendiente

🔴 **Los términos de uso de AREMA: SIN REVISAR**, igual que los de Luma y Superboletos.

🟡 **Las fichas con markdown se enseñan crudas.** Muchas sinopsis traen `**Fecha:**` y la
UI las pinta como texto plano, asteriscos incluidos. El parser los ignora, pero la
descripción se guarda tal cual — y `upsertEvents` conserva la existente (`existing.description
?? ev.description`), así que limpiarlas no bastaría con cambiar el conector.

---

## Fever — `fever`

La única fuente que **no** es boletera de conciertos: Candlelight (a la luz de velas, en
el Museo de Historia Mexicana), experiencias inmersivas, museos, juegos callejeros y
cena-espectáculo. Implementada el 2026-08-07 y **reescrita la etapa 2 el 2026-08-13**
(ver "Cuando Fever se pasó a Angular", abajo). **Cero solape con las demás**: no comparte
ni un venue con ninguna otra fuente, medido sobre la BD dev.

Rinde **~56 eventos de 34 planes publicables** — de los 49 que trae la home, 13 son
tarjetas de regalo o entradas sin fecha (`isTimeless`) y 2 son de otra ciudad.

### Cómo funciona

Dos etapas, y la segunda **no es opcional**. La primera es scraping; la segunda, la API
REST del propio sitio:

```
GET /es/monterrey                                   → sólo la LISTA de ids (49 planes)
GET /api/4.4/plans/<id>/                            → el plan: ciudad, sede, categoría, precio
GET /api/4.2/plans/<id>/place/<placeId>/sessions/   → sus funciones      (planes normales)
GET …/place/<placeId>/availability/?from=&to=       → sus días abiertos  (corridas continuas)
GET …/place/<placeId>/sessions_for_date/<día>/      → las horas de ESE día    (idem)
```

1. **La home es Astro.** Cada tarjeta es una isla cuyo `props` trae el plan en JSON
   escapado como HTML y con **cada valor envuelto en una tupla `[0, valor]`** (`[1, …]`
   para arreglos), que hay que desenvolver recursivamente. De aquí se usa sólo el `id` —
   y `isTimeless`, para ahorrarse 13 peticiones de planes que se iban a descartar.
2. **El detalle es JSON de la API**, en `snake_case`: `city_slug`, `places` (nombre **y
   dirección**), `categories`, `description`, `media_gallery`, `price_info`, `is_timeless`,
   `is_calendar_selector`, `first_active_session_date`. No trae funciones: ésas son otra
   petición, y **cuál depende de `is_calendar_selector`**.

**Por qué hace falta la etapa 2:** en la home `startDate`/`endDate` son un **rango** ("El
Laberinto de Tim Burton", del 6 al 16 de agosto, es un solo plan), no una función.
Publicando el rango, el evento saldría el día del estreno y desaparecería el resto de la
corrida. Son ~79 peticiones en tandas de 4 (regla 6); la corrida completa tarda ~3 s.

**Los planes se venden de dos formas**, y cada una tiene su endpoint — los mismos que usa
el sitio, que es la razón de no mezclarlos:

| Forma | Quién la usa | Qué se pide | Qué se publica |
|---|---|---|---|
| Funciones sueltas | Los Candlelight, The Jury Experience, el Jazz Room | `sessions/`: árbol `fecha → hora → sesión` con `starts_at_iso`, `ends_at_iso`, `price` y `has_available_tickets` | **Un evento por día**, con la primera función del día y el precio más barato/caro de sus zonas |
| Corrida continua (`is_calendar_selector`) | Museos, exposiciones, juegos callejeros | `availability/`: mapa `YYYY-MM-DD → {status, min_ticket_price}` en una ventana de 60 días, y luego `sessions_for_date/` **sólo del día elegido** | **UN solo evento**, en el próximo día abierto. Como la ingesta corre a diario, la fecha se recorre sola |

⚠️ **No vale pedirle `sessions/` a un plan con calendario**, aunque responda 200: su
disponibilidad ahí NO es la que el sitio muestra. La Odisea IMAX aparecía con lugar hoy
por `sessions/` y el calendario la daba agotada hasta ocho días después. El sitio nunca
llama a ese endpoint para esos planes, y por eso nosotros tampoco.

Lo que **no** se usa: `data-search.apigw.feverup.com` existe pero es una FastAPI
autenticada (`/docs` → 401). Y `/es/monterrey/<categoria>` (Angular SSR, otro stack por
completo) sólo aportaba 4 planes que la home no tiene y ninguna fecha que la etapa 2 no dé
mejor. `robots.txt` permite las rutas que sí se usan.

### Cuando Fever se pasó a Angular (2026-08-13)

Vale la pena por lo que enseña sobre elegir de dónde leer:

- **Qué pasó.** La etapa 2 leía `/m/<id>` y sacaba todo de un
  `<script id="astro-tools-transfer-state">`. Fever migró esa página a Angular; el script
  ahora se llama `serverApp-state` y, sobre todo, **ya no precarga las funciones**: para
  un Candlelight sólo trae el detalle y UNA sesión (`default_session`). Renombrar la
  clave no habría alcanzado.
- **Cómo se encontró la API** (receta de la regla 8, paso 3): la página no dispara ni una
  petición de sesiones al cargar —las trae el SSR o el usuario al abrir el selector—, así
  que anotar la red con CDP **no bastó**. Lo que la destapó fue bajar los ~220 chunks del
  bundle y buscar en ellos el nombre de la clave del transfer-state
  (`getPlanSessionsForPlaceAndDate`): ahí estaban las plantillas de URL y, en otro chunk,
  el `getApiBaseUrl("4.4")` con la versión de la API. La base (`https://feverup.com/api/`)
  no es un literal del bundle; se probó a mano.
- **Qué se ganó.** La etapa 2 ya no depende del markup ni del framework de nadie: es JSON
  con nombres estables. Si mañana cambian otra vez el front, esto sigue en pie — lo que
  quedaría expuesto es la **etapa 1**, que sí sigue leyendo islas de Astro de la home.

### Trampas y dónde está la defensa

| Trampa | Defensa |
|---|---|
| 🔴 **13 de los 49 planes de la home no son eventos**: tarjetas de regalo disfrazadas de plan (con fecha `2030-01-01`) y entradas sin fecha fija | `isTimeless`, que las marca a todas. De paso desaparece el problema de `Localización Secreta Monterrey` (12 planes), que no es un venue sino "no te decimos la sede hasta que compres": era la sede de las tarjetas |
| 🔴 **Se cuelan planes de otra ciudad** en la home de Monterrey (Ricardo Arjona en Aguascalientes, el PGA Tour en Vallarta) — y la home los lista con el **nombre de su recinto**, así que ahí no se distinguen | `city_slug !== "monterrey"` en el detalle. Filtrar por nombre de sede sería una lista negra que envejece |
| 🔴 **`startDate`/`endDate` de la home son un RANGO, no una función** | Toda la etapa 2 existe por esto |
| 🔴 **Un plan que corre a diario inundaba la cartelera**: el "City Tour Hop On/Hop Off" publicaba 10 renglones idénticos | Más de `MAX_DIAS_SUELTOS` (6) días distintos ⇒ se trata como corrida continua y sale uno solo. Los Candlelight, que sí queremos expandir, no pasan de 3 fechas; el Jazz Room, de 4 |
| **Días agotados**: "La Odisea IMAX" llegó a tener `sold_out` las dos primeras semanas | Se saltan los `status: "sold_out"` del calendario. Ojo: `"low"` y `"medium"` son "quedan pocos", **no** "no hay" |
| **El primer elemento de `media_gallery` es un VÍDEO** en la mitad de los planes | La portada se elige por su `category.role: "cover_image"`, no por posición; `gallery` (sólo fotos) es el respaldo |
| **`type: "waitlist"`** — el LIV Golf 2027 no es un evento, es apuntarse a una lista | Sólo se publica `type: "standard"` |
| Un plan cuyo detalle o disponibilidad no se puede leer | Se cuenta y se avisa por `console.warn`; si fallan **todos**, revienta (regla 1) |
| La home responde 200 aunque cambie el markup | Cero islas ⇒ error. Y si la home viene sana (≥30 planes) pero salen <15 eventos, también: ése es el colapso parcial que `hayCaida()` no ve |

### Notas

- **Fever no manda categoría en el plan de la home**; sí en el detalle, con **su** taxonomía
  (regla 3): `category` (`concert`, `nightlife`, `cinema`, `theater`, `tourism`, `mix`,
  `sport`) y `categories`, una lista larga en inglés. `nightlife` **no es fiesta**: es donde
  meten los Candlelight, así que va a `musica`. `mix` es su cajón de sastre y va a `cultura`.
  8 de los 49 la traen vacía —cuatro de ellos Candlelight—, y por eso hay un segundo intento
  sobre `categories` antes de caer en `cultura`. Ojo: en la API viene **`null`**, no `""`.
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
- **Las funciones que devuelve `sessions/` no son la temporada completa**, sino las que el
  selector muestra de entrada (2 o 3 fechas de un Candlelight, 10 días de una corrida).
  Alcanza de sobra para el horizonte de 10 días del digest, y se refresca a diario.
- **`accept-language: es-MX` en todas las peticiones.** La API responde en español por la
  ciudad del plan, pero mejor no depender de eso para el título y la descripción.

### Pendiente

- 🔴 **Los términos de uso de Fever: SIN REVISAR**, igual que los de Luma, Superboletos y
  AREMA.
- 🟡 **La etapa 1 sigue colgando del HTML de la home** (islas de Astro). Es lo único que
  queda expuesto a un rediseño; si algún día truena, hay que buscarle a la API la ruta que
  lista los planes de una ciudad.

---

## Tigres UANL — `tigres`

El otro equipo de la ciudad. Implementado el 2026-08-13, y hace falta porque
**Tigres no está en Ticketmaster en absoluto**: consultado por `venueId`, el Estadio
Universitario da 0 eventos, aunque Rayados sí entre por la consulta geográfica.
Son ~7 partidos de local por torneo, pero son de los eventos más grandes de la ciudad.

### Cómo funciona

El calendario de su sitio lo pinta un componente de terceros (Datagraph, de
mango-soft) que lee una API JSON sin autenticación:

```
GET https://datagraph-api.tigrespromo.com/v1/objects/match?edition_id=<TORNEO>
```

Devuelve **la Liga MX entera** (153 partidos), no sólo los de Tigres; se filtran los
de local por el id del equipo. La URL **no está en el bundle**: salió de capturar la
red del navegador con CDP, que es el paso 3 de la receta de la regla 8.

**Por qué hay etapa 1:** el `edition_id` identifica el torneo y cambia cada temporada
(Apertura → Clausura). Hardcodearlo mata la fuente cada seis meses, así que se lee de
la propia página del calendario, donde el componente lo trae como atributo.

### Trampas y dónde está la defensa

| Trampa | Defensa |
|---|---|
| 🔴 **Los atributos del componente traen espacios alrededor del `=`** (`edition = "…"`), así que un patrón normal no los encuentra | Los patrones aceptan cualquier espacio en blanco. Mismo caso que las etiquetas partidas de CONARTE |
| 🔴 **La página se queda apuntando a un torneo VENCIDO.** Comprobado: la del **femenil** sigue en "Liga MX Femenil - 1 Clausura", que terminó el 30 de junio, y por eso da **cero** partidos futuros | El conector revienta si `edition.end_date` ya pasó. Sin eso, en enero el varonil daría cero y sería indistinguible de "todavía no publican el calendario" (regla 1) |
| El id del equipo también sale de la página: si cambia de formato, el filtro de "local" deja pasar cero **sin que la API falle** | Revienta si ningún partido de la edición es de Tigres |
| La API no manda sede — trae la liga entera | El recinto de los partidos de local se sabe por definición: `Estadio Universitario`. Ningún otro conector tiene ese venue |

### Notas

- **Las fechas traen offset** (`2026-08-22T01:00:00+00:00`), así que **no** necesitan
  `fechaZonaAUtc`. El test lo fija bajo tres zonas para que nadie lo "arregle" con un
  parseo naive, que pasaría en prod (`America/Monterrey`) y fallaría en local.
- **No trae precio.** El checkout es de Boletomóvil, a otra petición; se deja
  `undefined`, que es "no sé" y no `0` (regla 4). El `ticketUrl` apunta a
  `boletomovil.com/club-tigres`, que es lo que enlaza su propio sitio.
- El título lleva la jornada (`Tigres vs Atlante — Jornada 5`) porque dos partidos
  contra el mismo rival en un torneo se distinguen por eso.
- **Sólo el varonil.** El femenil está detrás del mismo componente en
  `/es/tigres-femenil/calendario-de-juegos/` (edición `695bedb…`, equipo `085528…`),
  pero su `edition_id` está vencido: agregarlo hoy sería agregar una fuente que
  revienta desde el primer día. Cuando el sitio lo actualice, es una entrada más.

---

## MARCO — `marco`

El Museo de Arte Contemporáneo de Monterrey, el museo privado grande de la ciudad.
Implementado el 2026-08-13. **No lo cubre nadie más**: CONARTE es cultura del estado
y Fever no vende sus actividades. Aporta conversatorios, talleres y domingos
familiares, casi todos gratuitos.

### Cómo funciona

Es WordPress y su REST API estándar **está expuesta pero NO sirve**, exactamente
igual que la de CONARTE: hay un post type `eventos`, pero `acf` viene vacío,
`content` viene vacío y `date` es la fecha de publicación. Los datos sólo están en el
HTML del listado (`/eventos/`), que **agrupa por día**: un
`<h2 class="evento-group-header">` con la fecha y debajo las tarjetas de ese día.

**La fecha del encabezado es la buena.** Las tarjetas repiten la suya en formato
libre ("Del 10 de agosto al 30 de septiembre") y eso no siempre es una fecha.

### Trampas y dónde está la defensa

| Trampa | Defensa |
|---|---|
| 🔴 **La paginación MIENTE**: los enlaces dicen `/eventos/page/2/` y esa URL responde **404**. El tema los intercepta con JS y pide una ruta REST propia que devuelve el HTML ya renderizado | Se pagina por `https://www.marco.org.mx/wp-json/eventos/v1/filtrar?paged=N`, que delató `page-eventos.js`. Sin ella se pierde la segunda página entera —"Pinta tu mascota"— **sin que nada falle**: la primera responde 200 y trae eventos |
| Los enlaces de la paginación caen en el mismo patrón que las tarjetas de evento | Se descartan por URL (`/eventos/page/N/`) y, de rebote, por no traer título |
| **Las entradas sin hora** ("Del 10 de agosto al 30 de septiembre") no son eventos de un día: son inscripciones abiertas a cursos de temporada | Se descartan y se cuentan en un `console.warn`. Inventarles una hora las metería en la cartelera y en el ICS con un dato falso |
| El listado deja el evento del día en curso aunque ya haya pasado su hora | Se filtra por fecha futura, y el filtro vive en el conector —no en `parseListado`— para que el parseo se pueda probar con un fixture sin que el reloj lo vacíe |
| Cambio de tema del sitio = fuente muda | Revienta si **ninguna** página trajo encabezados de día, y también si las trajo y aun así no salió un solo evento |

### Notas

- **Las horas son *timezone-naive*** en hora de Monterrey → `fechaZonaAUtc()`, el
  mismo de CONARTE y Superboletos. Tests bajo `TZ=UTC`, `America/Monterrey` y
  `Asia/Tokyo`.
- **Todo cae en `cultura`**, por la regla de "a qué va la gente": salir, ver arte.
  Los talleres artísticos ya están nombrados en esa categoría.
- Los rangos de hora ("10:00 a 13:00 hrs") sí producen `endsAt`; una hora suelta no.
- **"Evento gratuito" es `0`, un dato real** (regla 4). Un rango
  ("$1,400 - 3,000 MXN") produce `priceMin` y `priceMax`.
- Sólo se pide la primera página a la URL canónica y el resto a la ruta REST del
  tema: si el tema cambia y la ruta desaparece, la fuente pierde la cola pero no se
  apaga entera.

### Pendiente

🟡 Los post types `exposiciones` y `cursos` **no se ingieren**. Una exposición dura
meses y no es un evento de un día; encajaría mal en una cartelera por día. Si algún
día hay dónde ponerlas, ahí está el hilo.

---

## Cultura UANL — `cultura-uanl`

El programa cultural de la universidad pública del estado. Implementado el 2026-08-13
al cerrar el pendiente de "los auditorios universitarios". Aporta ciclos de cine,
exposiciones, conferencias y conciertos en **cinco recintos que no tiene nadie más**:
Colegio Civil CCU, Sala Fósforo, Aula Magna, la Capilla Alfonsina y el CIIDA de
Mederos. Casi todo de entrada libre — el hueco de "lo gratuito universitario", que ni
las boleteras venden ni CONARTE cubre (esa es cultura del **estado**, no de la UANL).

### Cómo funciona

Es la fuente más limpia del proyecto, y por una razón concreta: su WordPress usa el
plugin **The Events Calendar**, que trae su propia REST API, **documentada y
versionada**:

```
GET https://cultura.uanl.mx/wp-json/tribe/events/v1/events?per_page=50&start_date=YYYY-MM-DD
```

Una petición por corrida (~900 ms). No hay etapa 2: el listado ya trae título,
descripción, imagen, `start_date`/`end_date`, `cost`, categorías y el objeto completo
de la sede con dirección, ciudad, estado y CP. `robots.txt` sólo prohíbe `/wp-admin/`.

⚠️ **No es la REST API estándar de WordPress**, que aquí también está expuesta y sería
igual de inútil que en CONARTE y en MARCO. Son dos APIs distintas en el mismo sitio, y
la buena es la del plugin. Ver la regla 8.

### Trampas y dónde está la defensa

| Trampa | Defensa |
|---|---|
| 🔴 **El catálogo de sedes NO es sólo de Monterrey**: tiene la Capilla Alfonsina del **INBAL (Ciudad de México)** y la **Casa da América Latina (Lisboa)**, de colaboraciones y giras. Una agenda universitaria publica lo suyo esté donde esté | `esDeNuevoLeon()`, y **no basta con `province === "Nuevo León"`**: el Teatro de la Ciudad la escribe `"N.L."` y la Preparatoria 2 **no trae provincia**, sólo el CP dentro de la calle. Tres pasos, del dato más fiable al menos: provincia → país → CP (Nuevo León va de 64000 a 67999) |
| 🔴 **Dos sedes ya estaban en la BD con otro nombre**, puestas por AREMA: `Aula Magna Fray Servando Teresa de Mier del Colegio Civil CCU` es su `Aula Magna Colegio Civil`, y `Teatro Universitario, Unidad Mederos` su `Teatro Universitario UANL` | `ALIAS_VENUE` por nombre **exacto**, como en AREMA. Sin esto, el dedupe (sede + día + título) no podría fusionar nunca un evento que aparezca en las dos fuentes, porque para él serían recintos distintos. Con "parecido" en vez de exacto se fusionarían las **tres** sedes distintas que empiezan por "Colegio Civil" |
| **Un taller de varias semanas se publica como UN evento** cuyo fin es el de la última sesión: el "Círculo de lectura" va del 19 de agosto al 23 de septiembre | Se descarta `endsAt` si dura más de 24 h. Mejor sin hora de fin que con una falsa en el calendario y en el ICS. Mismo caso que en Luma |
| Las fechas son *timezone-naive* (`2026-08-12 12:00:00`) | `fechaZonaAUtc()` con `America/Monterrey`. El plugin **también** manda `utc_start_date` ya calculado y **no se usa**: depende de la zona configurada en ese WordPress, que hoy dice `America/Mexico_City` — coincide en offset, pero es la configuración de otro. Se prefiere la hora de pared, que es la que el sitio le enseña al público. Tests bajo tres zonas |
| Una agenda vacía responde **200 con `events: []`**, y una página de más responde **404** con `event-archive-page-not-found` | Los dos casos cortan la paginación sin reventar; lo que sí revienta es que la API devuelva eventos y no se pueda mapear ninguno (regla 1), o que la respuesta deje de traer `events` |

### Notas

- **`cost` es texto libre**: `"Entrada libre"` → `0`, que es un dato real; vacío →
  `undefined`, que es "no sé" (regla 4). Medido el 2026-08-13: 5 de 12 gratis, 7 sin
  precio.
- **…y cuando `cost` viene vacío, la entrada libre está dicha en la descripción**
  (2026-08-14). Era el caso de 6 de esos 7. `entradaLibreEnTexto()` la lee como respaldo
  y ahora **los 10 que la fuente lista están en `0`** — que es lo que le da valor a esta
  fuente, siendo casi todo su programa gratuito. Tres cuidados, porque una descripción no
  es un campo corto:
  - **No se buscan cifras, sólo la frase.** La prosa está llena de números que no son
    precios (`2023, 127 min`, `19:00 horas`, `1955`); `parsePrecio` aplicado al texto
    largo los tomaría por pesos.
  - **`libre` a secas no cuenta.** Vale en `cost`, pero en prosa es "aire libre" y "verso
    libre": la frase tiene que estar completa (`entrada libre`, `acceso libre`, …).
  - **Si el texto menciona un monto, no se declara gratis.** "Entrada libre a la
    exposición, taller con costo de $200" no es un evento gratuito.

  ⚠️ Al medirlo contra la BD sale **menos** cobertura de la real: el conector guarda la
  descripción **recortada a 500 caracteres** pero evalúa la completa, y "Entrada libre"
  suele ir al final ("Los recuerdos de la luz" la tiene en el carácter 612). Para medir
  esto hay que pegarle a la API, no a la tabla.
- **El día se pide en hora de Monterrey**, no en UTC (`hoyEnMonterrey()`): a las 20:00
  de aquí ya es el día siguiente en UTC y un `toISOString()` se habría comido los
  eventos de esa misma noche. El cron corre a las 06:00, así que ese bug no se habría
  visto nunca en producción.
- **Sólo `Música` y `Concierto` salen de `cultura`.** La categoría que se antoja
  `tecnologia` es `Academia`, y no lo es: son coloquios y conferencias de facultad, no
  meetups de industria, que es lo que esa categoría significa aquí.
- **Cero duplicados con lo que ya había** (medido el 2026-08-13 contra la BD dev): de
  sus cinco sedes, cuatro no tienen un solo evento de otra fuente, y en `Aula Magna
  Colegio Civil` —donde AREMA sí vende— no hay ni un par mismo-día que revisar.
- El municipio real va en `venue.zone` y `city` queda en `"monterrey"`, como en AREMA:
  San Nicolás de los Garza es otro municipio del área, no otra ciudad.

---

## Fuentes sin explorar

Sondeadas el 2026-08-13, de más a menos prometedoras. Las tres que salieron viables
—Tigres, MARCO y Cultura UANL— ya tienen su ficha arriba; éstas son las que **no**.

### Antes: qué quiere decir cada veredicto

Las tres razones para no integrar una fuente son distintas, y confundirlas hace que
una candidata viva parezca muerta. **La primera versión de esta tabla las confundió
en dos de seis filas**, así que vale la pena escribirlas:

- **Cerrada** — el servidor rechaza la petición y no hay ruta que no sea evadirlo.
  El criterio es que **bloquee igual a un navegador de verdad que a nosotros**: eso
  es un WAF filtrando clientes no-navegador, no una preferencia de User-Agent.
- **Filtra por User-Agent** — nos rechaza a nosotros y deja pasar a un navegador.
  **No es lo mismo que cerrada**: es alcanzable quitando el UA identificable, y eso
  es una decisión de política (regla 6), no un imposible técnico.
- **Descartada por contenido** — responde perfectamente y no tiene lo que buscamos.
  Es el veredicto más definitivo de los tres, porque no cambia con la técnica.

| Candidata | Qué respondió | Veredicto |
|---|---|---|
| **Sultanes de Monterrey** (béisbol) | 403 a nuestro UA, **200 a un UA de navegador**. Insistiendo dejó de responder del todo (`000`) | **Filtra por UA — NO está cerrada.** Es la única candidata con contenido que de verdad nos falta (béisbol, temporada larga). Entrar exige quitar el UA identificable, que es justo lo que la regla 6 pide conservar y lo que se decidió no hacer con Boletia: **es una decisión del dueño del proyecto, no técnica**. Su `EXPLANADA SULTANES` existe en el catálogo de Ticketmaster pero con **0 eventos** |
| **Resident Advisor** (`ra.co`) | 403 en `/` y en `/events/mx/monterrey` **con los dos User-Agents**; su `robots.txt` sí responde 200 | **Cerrada**, patrón de Boletia. Matiz que conviene saber: su `robots.txt` **nos permite** todo salvo `/pro`, `/user`, `/api`, `/widget` y una lista de bots comerciales donde no estamos. O sea, cerrada **de hecho, no de derecho** |
| **Ticketon** | home 200; sus ciudades son Atlanta, Chicago, Dallas, Denver, Houston, Las Vegas, Los Ángeles, Miami, Nueva York, San José y El Salvador | **Descartada por contenido.** Es una boletera del **mercado latino de Estados Unidos** (regional mexicano, cine y merch): **ni una ciudad de México**. Por eso todas las rutas por ciudad daban 404 — no es que no se le encontrara la estructura, es que no cubre Monterrey |
| **Passline** | 403 con **los dos** User-Agents; `robots.txt` responde 200 | **Cerrada**, y ahora sí comprobado (2026-08-13). Es un **desafío gestionado de Cloudflare**: `cf-mitigated: challenge` y la página "Just a moment…" con el script de `challenges.cloudflare.com`. Pasarlo es evadir el WAF, que es exactamente lo que se decidió no hacer con Boletia. `passline.com.mx` es otro dominio, y está vacío |
| **tuboleto.com.mx** | no resuelve por DNS | Muerta |
| **Parque Fundidora** | sitio .NET sin sección de eventos | Publica en Instagram y Facebook, que están descartados por diseño de Meta (abajo). Ojo: sus eventos con boleto **ya entran** por Ticketmaster, que lo lista como venue |

⚠️ **La lección de método, que vale para la siguiente:** un 403 con nuestro
User-Agent **no prueba nada por sí solo**. Hay que repetir la prueba con un UA de
navegador antes de escribir "cerrada" — si pasa, la fuente está viva y lo que hay es
una decisión que tomar. Sultanes se dio por muerta durante media sesión por saltarse
ese paso.

### Meetup.com: descartado por contenido (sondeado el 2026-08-13)

Se esperaba que complementara a Luma en tech. **No hay tal cosa que complementar**, y
el problema no es técnico: el sitio responde 200 a nuestro User-Agent y trae los
eventos en el `__NEXT_DATA__` de la página, con fecha, sede y dirección.

Lo que lo mata son dos cosas, en este orden:

1. **Casi no hay inventario presencial en Monterrey.** La búsqueda de la ciudad
   devuelve **9 eventos reales** (los otros 20 del estado son ocurrencias de series
   recurrentes), y **6 de los 9 son ONLINE**. Mirando los grupos de la ciudad uno por
   uno: el AWS User Group tiene **0** eventos futuros; LFDT Monterrey tiene 6 y **los
   6 son webinars**; Kong tiene **1** presencial. Un webinar no va en la cartelera de
   una ciudad. El único grupo con volumen es un club de juegos de mesa que se junta
   dos veces por semana: **30 eventos futuros casi idénticos**, o sea el problema del
   "City Tour Hop On/Hop Off" de Fever pero sin nada que rescatar al lado.
2. **La ruta que sirve está prohibida por `robots.txt`.** `Disallow: /*?location=*`
   cubre exactamente `/find/?location=mx--Monterrey`, que es la única con el catálogo;
   también están fuera `/gql*`, `/api` y `/_next/data/*`. Lo que sí permiten —y hasta
   listan en su sitemap— es la ruta sin query (`/find/mx--monterrey/`), pero ésa es
   una **página de teaser: 3 + 1 + 1 eventos fijos**, con listas vacías para música,
   deportes y aire libre. No existe una ruta de tema `tech` para Monterrey: de los
   ocho caminos `mx--monterrey` del sitemap, ninguno lo es (son bookclub, debates,
   improv y social).

Quedaba una ruta limpia: las páginas de grupo (`/{grupo}/events/`, permitidas y con 40
eventos en el estado de Apollo). Requiere mantener a mano una lista de grupos, y por
el punto 1 lo que rendiría es un club de juegos de mesa. **No se hace.**

### Los auditorios universitarios: uno entró, dos no (2026-08-13)

⚠️ **Antes que nada, porque se presta a confusión:** el camino que NO funcionó fue
buscarle el sitio a cada auditorio por su cuenta. El contenido **sí** es de auditorios
universitarios, y hoy están cubiertos casi todos — lo que pasa es que entran por la
agenda que los publica juntos, no por un conector por recinto. Cómo queda la ciudad
universitaria después de esta sesión (medido en la BD dev el 2026-08-13, sólo eventos
futuros):

| Recinto | Futuros | Quién lo trae |
|---|---|---|
| Sala Fósforo, Colegio Civil CCU | 4 | `cultura-uanl` ← **nuevo** |
| Colegio Civil CCU | 3 | `cultura-uanl` ← **nuevo** |
| **Aula Magna** Fray Servando (Colegio Civil) | 2 | `cultura-uanl` ← **nuevo** |
| CIIDA UANL (Mederos) | 2 | `cultura-uanl` ← **nuevo** |
| Capilla Alfonsina Biblioteca Universitaria | 1 | `cultura-uanl` ← **nuevo** |
| Auditorio Luis Elizondo (Tec) | 3 | `ticketmaster`, `arema` — ya entraba |
| Teatro Universitario UANL | 1 | `arema` — ya entraba |
| Estadio Universitario | 7 | `tigres` — ya entraba |

El **Aula Magna Fray Servando es** el auditorio grande del Colegio Civil, y entró. El
**Teatro Universitario de Mederos también está en el catálogo de sedes de Cultura
UANL** (por eso lleva entrada en `ALIAS_VENUE`): hoy no tiene función publicada ahí,
pero cuando la haya entra sola, sin tocar código.

Lo que sigue sin cubrir son **los auditorios de facultad sueltos** (Preparatoria 8,
Organización Deportiva, las salas de Agronomía). Ésos sólo viven en
`uanl.mx/eventos`, que es la agenda descartada abajo — y lo que publican son
capacitaciones internas, no programación pública.

Dicho eso, eran tres cosas distintas metidas en la misma línea, y sólo se parecen en
el nombre:

- ✅ **Cultura UANL** (`cultura.uanl.mx`) — implementado, [ficha
  arriba](#cultura-uanl--cultura-uanl). Es donde estaba de verdad lo gratuito.
- ❌ **Tec de Monterrey** (`tec.mx`) — **cerrado de derecho**: su `robots.txt` es
  `User-agent: * / Disallow: /`, el sitio entero. Además no tiene agenda pública que
  scrapear aunque se quisiera: `/es/eventos` redirige a `/es/posgrados/eventos`, que
  es un 404 servido con **403**, y lo que el sitemap llama "eventos" es la sección
  para **rentar** sus venues. El **Auditorio Luis Elizondo** ya entra por Ticketmaster
  y AREMA, así que lo que se pierde es sólo lo gratuito del campus.
- ❌ **La agenda institucional de la UANL** (`uanl.mx/eventos`) — **descartada por
  contenido**, y conviene saber por qué, porque técnicamente es la más fácil de todas:
  el listado paginado ya trae día, mes, título, sede y hora en la tarjeta, sin
  necesidad de abrir el detalle. El problema es lo que hay dentro. Son **46 eventos**
  futuros y la mayoría es vida interna de la universidad: cursos de agronomía,
  capacitaciones en línea, torneos de facultad, convocatorias. **24 de los 46 no traen
  hora** y 8 no traen sede. Y sobre todo: **repite los culturales con otro nombre de
  sede** —el mismo ciclo de cine es "Auditorio CEIIDA" ahí y "Centro de Investigación,
  Innovación y Desarrollo de las Artes UANL" en Cultura UANL—, así que ingerir las dos
  duplicaría media programación **sin que el dedupe pudiera verlo**. Es el caso de la
  regla 7 en su forma más cara: mismo evento, misma hora, sede escrita distinto.

  Su REST API de WordPress, por si alguien la vuelve a mirar: existe un post type
  `eventos` con 681 registros y es **inútil**, igual que la de CONARTE y la de MARCO —
  `acf` viene vacío y `date` es la fecha de publicación.

**No hace falta sondear el Colegio Civil por su cuenta**: sus tres espacios (el
recinto, la Sala Fósforo y el Aula Magna) ya entran por Cultura UANL, y son 9 de los
12 eventos de esa fuente.

Los dos pendientes viejos se cerraron el 2026-08-07, y ninguno necesitó conector
propio:

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
