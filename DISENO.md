# Diseño "Tablero" — sistema visual y reglas de la cartelera

> Documento de referencia del lenguaje visual. La narración de **cómo se llegó** a
> esto (y qué se probó y se descartó) está en `HANDOFF.md`, "Sesión 2026-08-10".
>
> Estado: vive en la rama `diseno/rediseno-completo`, **sin mergear a `main`** y
> **sin pushear**. Producción sigue con la "Marquesina" oscura del 2026-07-21.

La cartelera de Monterrey como un **tablero de salidas de acero**: Fundidora,
espectaculares, pintura de seguridad. Industrial regiomontano.

**Lo memorable es la hora.** Todo se ordena alrededor de cifras monoespaciadas
tabulares, y cada día abre con su numeral. Si un cambio futuro le quita
protagonismo a la hora, está peleándose con la dirección.

**Es un mundo oscuro único: NO hay tema claro ni interruptor.** No es un olvido —
es la regla central del skill que guio el rediseño (`frontend-design`): elegir una
dirección y comprometerse. Un tema doble diluiría las dos. Si algún día se quiere
tema claro, es un rediseño, no un añadido.

---

## 1. Color

Un campo dominante, **un solo acento**, y una familia sistemática para categorías.
Todo en `src/app/globals.css`.

| Token | Valor | Para qué |
|---|---|---|
| `--fierro` | `#141210` | fondo dominante (negro cálido de fundición) |
| `--fierro-2` | `#1d1a17` | superficie elevada: inputs, diálogos, banda del día |
| `--cal` | `#f4f1ea` | texto principal |
| `--ceniza` | `#9a938a` | texto secundario (≈6.4:1 sobre `--fierro`) |
| `--linea` | `rgba(244,241,234,.14)` | filetes de 1 px |
| `--senal` | `#ff5b23` | **acento único** (naranja de seguridad) |
| `--alerta` | `oklch(.68 .2 15)` | cancelaciones y errores de formulario |

**`--senal` significa "esto es la acción principal o el estado activo".** Botón
primario, pestaña de filtro activa, marca "MX", etiqueta HOY/MAÑANA, anillo de
foco, título en hover. Nada más. En cuanto se use para decorar, deja de señalar.

`--alerta` existe porque es el único rol que `--senal` no puede cubrir: un evento
cancelado no es la acción principal de nadie.

**La pestaña activa va entre corchetes, no subrayada** (2026-08-11). `[ ESTE
FIN ]` en `--senal`; el filete de 2 px de abajo era el subrayado que sale por
defecto y se leía como tal.

Los corchetes **se reservan en todas las pestañas**, transparentes mientras están
apagadas (`.pestana` en `globals.css`). Si sólo existieran en la activa, cada
clic correría a las pestañas de su derecha y en móvil cambiaría el corte de línea
de la fila entera. En hover, una pestaña apagada insinúa sus corchetes en
`--linea`.

Eso cuesta ancho: reservarlos dejaba la fila 50 px por encima de los 1052 px
disponibles y la partía en dos renglones. Se recuperó con márgenes de `0.15em` en
los corchetes y bajando el hueco de la fila de `gap-x-5` a `gap-x-4` — quedan 39
px de sobra en escritorio y tres renglones en móvil, los mismos que antes. **Si
se agrega una pestaña más, esa cuenta se rompe**: medir antes de dar por bueno.

### Las categorías son una familia, no un arcoíris

```css
--musica:     oklch(0.78 0.12 75);   /* oro     */
--deportes:   oklch(0.78 0.12 145);  /* verde   */
--tecnologia: oklch(0.78 0.12 230);  /* acero   */
--cultura:    oklch(0.78 0.12 300);  /* violeta */
--bienestar:  oklch(0.78 0.12 350);  /* rosa    */
```

**Misma lightness y mismo croma; sólo cambia el matiz.** Así el color informa
(qué categoría) sin que unas griten más que otras ni compitan con `--senal`, que
es mucho más saturado. Los matices están repartidos lejos entre sí y lejos del
naranja (~38).

Se usan como **filete de 2 px + versalita mono**, nunca como píldora rellena:
cinco píldoras de color en una fila de eventos vuelven la cartelera un semáforo.

Agregar una categoría = agregar un matiz **a la misma L y C**, no un color nuevo
a ojo.

---

## 2. Tipografía

| Rol | Fuente | Dónde |
|---|---|---|
| Display | `Anton` | titulares de página, numeral del día, marca |
| Cuerpo | `Geist` | títulos de eventos, párrafos, valores de campos |
| Mono | `Geist Mono` | horas, precios, rótulos, pestañas, etiquetas |

**Los títulos de los eventos van en Geist, no en Anton.** Anton es display de
rótulo: a 100 filas seguidas no se lee. Es deliberado, no una inconsistencia.

**Los titulares de display llevan `tracking-[0.11em]`.** Anton es muy condensada y
sin espaciado se apelmaza. El valor salió de medirlo en el navegador: 0.035em no
se distinguía del original (455 px vs. 455 px de titular), 0.11em da 526 px.

⚠️ `letter-spacing` mete hueco también **después de la última letra**. Cuando un
titular termina en un `<span>` (el punto naranja de "en Monterrey."), hay que
compensarlo con `-ml-[0.11em]` o queda flotando.

**Todos los titulares de display van a `leading-[1.04]`, sin excepciones.** Antes
iban entre 0.86 y 0.92 y las líneas se montaban: Anton ya trae una caja de línea
apretada, así que apretarla más deja "QUÉ HAY / EN MONTERREY." como un bloque
sólido. El espaciado horizontal (0.11em) no arregla eso — el amontonamiento de un
titular de dos líneas es vertical.

**Los títulos de eventos van a `tracking-[0.01em]`, no negativo.** Muchos llegan
en MAYÚSCULAS desde la fuente de datos, y el tracking negativo que funciona en
minúsculas los apelmaza.

---

## 3. Superficie y atmósfera

- **Radios de 2–4 px.** Nada redondeado: es acero, no jabón.
- **Filetes de 1 px** en `--linea`. La elevación se da con `--fierro-2` + filete.
- **El encabezado NO lleva franja naranja arriba.** Tuvo una de 3 px ("pintura de
  seguridad") y se quitó el 2026-08-11 a pedido del usuario: pegada al borde de la
  ventana se leía como una barra de carga, no como sello. El acento del encabezado
  es la marca "MX" y ya.
- **Cero sombras difusas.**
- **El fondo nunca es plano**: reflector radial cálido desde arriba + grano de
  película por `feTurbulence` en un `data:` URI (sin archivos ni peticiones de
  red), a 4.5 % de opacidad en `body::before`.

---

## 4. Movimiento

**Una sola secuencia dirigida**, y sin JavaScript: al cargar la cartelera las
filas suben escalonadas (`.entra` + `--i` por fila).

- El retardo se topa a **420 ms** (`min(calc(var(--i) * 18ms), 420ms)`) para que
  la fila 90 no entre segundo y medio después de la primera.
- El escalonado **no se reinicia en cada día**: el contador `fila` corre a lo
  largo de toda la cartelera, para que la lectura baje en una sola dirección.
- Fuera de eso sólo hay hover: póster a 1.03 dentro de un marco fijo, título a
  `--senal`, flecha que se desplaza.
- Todo se anula bajo `@media (prefers-reduced-motion: reduce)`.

Veinte micro-interacciones sueltas valen menos que una entrada bien dirigida.

---

## 5. Composición

- Ancho de la cartelera: **1100 px**. El detalle baja a 960 y los formularios a
  `max-w-sm/lg`.
- **La fila de evento es una fila de tablero**, no una tarjeta:
  `[hora mono] [póster] [título/lugar] [categoría] [precio] [→]`.
  El costado derecho lleva **datos**, no aire: con la fila a 1100 px, dejar sólo
  la etiqueta abría un hueco de media pantalla en medio de cada evento.
- El precio va con **ancho fijo y tabular** para que forme columna de arriba
  abajo. Sin precio se pone `—`, que mantiene la columna.
- **El encabezado de día NO es pegajoso.** Se probó y se quitó: viajaba hacia
  abajo montándose sobre los eventos, que además se pintaban por encima de él.
  Vive en el flujo, en una banda sobre `--fierro-2`, y por eso no necesita
  `z-index`.
- **Nada de rejas simétricas de tarjetas.**
- **El rótulo mono va ENCIMA del titular** en toda la app (ACCESO → ENTRAR,
  MONTERREY, N.L. — CARTELERA → QUÉ HAY). **`/mis-eventos` es la única excepción**:
  ahí va debajo, a pedido del usuario el 2026-08-11. Si algún día se unifica, que
  sea en todas a la vez.
- **Un formulario se agrupa por lo que los campos HACEN, no por orden de
  llegada.** `/perfil` tenía cuatro campos planos separados por el mismo hueco;
  como categorías y día son ambos del resumen semanal y nada más los lee, ahora
  son dos `<section>` con encabezado propio (2026-08-12). **El aire entre grupos
  lo pone un filete, no un hueco mayor**: separa igual y ocupa menos.
- **Dos niveles de rótulo, distinguidos por tono.** El encabezado de grupo usa la
  misma versalita mono que `ROTULO` pero en `--cal`; el rótulo de campo se queda
  en `--ceniza`. Sin esa diferencia los dos niveles se leen igual y el formulario
  vuelve a verse plano.
- **Un desplegable de opciones pocas, cortas y fijas es un desplegable de más.**
  Los 7 días del resumen pasaron de `<select>` a fila de botones: se ven todas de
  un vistazo y se elige con un clic en vez de dos. Por dentro son **radios reales
  ocultos** con `has-[:checked]`, no `<button>`, para no reimplementar el
  recorrido con flechas. El umbral es ese —pocas, cortas y fijas—, no "siempre".
- **La franja de conteo es de la cartelera, no del sistema.** `/mis-eventos` la
  tuvo y se quitó (2026-08-11): con una lista corta y propia, contar lo que ya se
  ve es cromo. Cuando se quita, el filete superior se mueve al `<ul>` y sólo se
  pinta si hay filas — si no, queda una raya huérfana bajo el estado vacío.

---

## 6. Dónde vive el sistema en el código

| Archivo | Qué manda |
|---|---|
| `src/app/globals.css` | tokens, grano, foco, keyframes, reduced-motion |
| `src/lib/ui.ts` | botones y campos (`BOTON_PRIMARIO`, `CAMPO`, `ROTULO`…) |
| `src/lib/events/categorias.ts` | color y armazón de la etiqueta de categoría |

**`src/lib/ui.ts` son constantes, no componentes**, a propósito: hay botones que
son `<button>`, otros `<a>` y otros `<Link>`, y envolver los tres costaría más de
lo que ahorra.

⚠️ **Todas las clases de Tailwind deben ser literales.** v4 genera las utilidades
**leyendo el código fuente**: un `text-${slug}` armado con plantilla no existiría
en el CSS y el chip saldría sin color, **sin ningún error que lo delate**.

---

## 7. Accesibilidad

- **Anillo de foco global** `:focus-visible` de 2 px en `--senal`, en
  `globals.css`. Antes del rediseño cada input hacía `outline-none` sin
  reemplazo y navegar con teclado era navegar a ciegas. **Ningún componente debe
  volver a poner `outline-none`.**
- Enlace "Saltar al contenido" al principio del `<body>`.
- La tabla de `/admin/salud` se desplaza sola (`overflow-x-auto`) en vez de
  romper la página.
- `--ceniza` sobre `--fierro` da ≈6.4:1. Bajarle luminosidad rompe AA.

---

## 8. Trampas ya pisadas

- **Apilar `backdrop-blur` sale carísimo.** Había una barra pegajosa con
  desenfoque por cada día de la cartelera; con el fondo ya opaco al 95 % no
  aportaban nada y **colgaban a Chrome** al capturar la página completa. El
  desenfoque queda sólo en la cabecera, que es una capa.
- **`getComputedStyle` miente sobre `outline-color`** en el Chrome headless que
  se usa para las capturas: devuelve el color del texto aunque la regla lleve un
  literal con `!important`. El anillo de foco se verifica **a ojo**, con un Tab
  de verdad (`Input.dispatchKeyEvent`), no leyendo estilos computados.
- **Un campo puede mentir sin que nadie lo note.** "Gustos específicos" pedía
  *"equipos, géneros, artistas"* y el match nunca miraba el título, sólo unos
  tags que son puro género y que trae el 31 % de los eventos: escribir un equipo
  o una banda devolvía cero, siempre (2026-08-12, campo retirado). Antes de
  diseñar un campo de entrada libre, **comprobar contra la BD que lo que se
  promete puede matchear**.
- **Un estado vacío no es un estado neutro.** En `/perfil`, "ninguna categoría"
  no significaba "todo" sino silencio total, y en la BD no se distingue de "aún
  no elijo". Por eso "Todo" se guarda como **las cinco categorías marcadas** y no
  como lista vacía: lo que se ve es lo que hay.
- El resto de trampas de captura y previews está en `AGENTS.md`.
