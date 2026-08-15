import { CATEGORIES, Category } from "./types";

// Cómo se ve cada categoría en la web. Antes esto estaba copiado tres veces
// (cartelera, detalle y perfil); con tres categorías se aguantaba, con cinco es
// una invitación a que se desincronicen.
export interface InfoCategoria {
  /** Chip de los filtros y etiqueta de cada evento. Corto. */
  nombre: string;
  /** Casilla del perfil: ahí sí conviene decir qué cabe dentro. */
  nombreLargo: string;
  /**
   * Clases de Tailwind **literales**: v4 genera las utilidades leyendo el código,
   * así que un `text-${slug}` armado con plantilla no existiría en el CSS y el
   * chip saldría sin color, sin ningún error que lo delate.
   *
   * En el diseño "Tablero" la categoría es un filete de 2 px + versalita mono,
   * nunca una píldora rellena: son cinco matices de una misma familia oklch
   * (misma lightness y croma), así que rellenarlos los volvería un arcoíris y
   * competirían con --senal, que es el único acento que puede gritar.
   */
  clases: string;
}

/** El armazón de la etiqueta; el color lo pone `clases`. */
export const CLASES_ETIQUETA =
  "border-l-2 pl-2 font-mono text-[0.62rem] uppercase leading-tight tracking-[0.14em]";

/** Para un slug que ya no exista en CATEGORIAS. */
export const CLASES_ETIQUETA_HUERFANA = "border-linea text-ceniza";

// Tipado como Record<Category, …> a propósito: agregar un slug a CATEGORIES sin
// darle su entrada aquí es un error de compilación. Con el Record<string, string>
// de antes, el olvido salía como un chip gris en producción.
export const CATEGORIAS: Record<Category, InfoCategoria> = {
  musica: {
    nombre: "Música",
    nombreLargo: "🎵 Música y conciertos",
    clases: "border-musica text-musica",
  },
  deportes: {
    nombre: "Deportes",
    nombreLargo: "⚽ Deportes",
    clases: "border-deportes text-deportes",
  },
  cultura: {
    nombre: "Cultura",
    nombreLargo: "🎭 Cultura y teatro",
    clases: "border-cultura text-cultura",
  },
  tecnologia: {
    nombre: "Tecnología",
    nombreLargo: "💻 Tecnología, meetups y negocios",
    clases: "border-tecnologia text-tecnologia",
  },
  bienestar: {
    nombre: "Bienestar",
    nombreLargo: "🧘 Bienestar y actividad física",
    clases: "border-bienestar text-bienestar",
  },
};

/** En el orden de CATEGORIES, que es el de los chips de la cartelera. */
export const CATEGORIAS_EN_ORDEN = CATEGORIES.map((slug) => ({ slug, ...CATEGORIAS[slug] }));

/**
 * `Event.category` es un `String` en la BD, no un enum: puede traer un slug que
 * ya no exista (o uno viejo). Por eso esto acepta `string` y puede no encontrar.
 */
export function infoCategoria(slug: string): InfoCategoria | null {
  return (CATEGORIAS as Record<string, InfoCategoria>)[slug] ?? null;
}
