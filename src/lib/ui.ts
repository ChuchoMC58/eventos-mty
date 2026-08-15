/**
 * Los controles del diseño "Tablero", en un solo lugar.
 *
 * Antes cada botón y cada input repetía su cadena de clases en el archivo donde
 * tocaba (cinco copias del botón naranja, cuatro del campo de texto); con eso,
 * ajustar el sistema significaba encontrar todas las copias y ninguna avisaba si
 * se quedaba una atrás. Son constantes y no un componente a propósito: hay
 * botones que son `<button>`, otros `<a>` y otros `<Link>`, y envolver los tres
 * costaría más de lo que ahorra.
 *
 * Han de ser cadenas **literales**: Tailwind v4 genera las utilidades leyendo el
 * código fuente, así que una clase armada con plantilla no existiría en el CSS.
 */

/** El acento único. Sólo para la acción principal de cada pantalla. */
export const BOTON_PRIMARIO =
  "bg-senal px-5 py-3 font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-fierro transition-[filter] hover:brightness-110 disabled:opacity-60";

export const BOTON_SECUNDARIO =
  "border border-linea px-5 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-cal transition-colors hover:border-cal disabled:opacity-60";

/**
 * Campos de texto y desplegables. Sin `outline-none`: el anillo de foco global
 * (`globals.css`) es lo único que hace visible la navegación por teclado, y
 * apagarlo aquí la dejaría invisible otra vez.
 */
export const CAMPO =
  "border border-linea bg-fierro-2 px-3 py-2.5 text-sm transition-colors focus:border-senal";

/** Rótulo de campo o de dato: versalita mono, como el letrero de un andén. */
export const ROTULO =
  "font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ceniza";
