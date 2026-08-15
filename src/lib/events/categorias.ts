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
   */
  clases: string;
}

// Tipado como Record<Category, …> a propósito: agregar un slug a CATEGORIES sin
// darle su entrada aquí es un error de compilación. Con el Record<string, string>
// de antes, el olvido salía como un chip gris en producción.
export const CATEGORIAS: Record<Category, InfoCategoria> = {
  musica: {
    nombre: "Música",
    nombreLargo: "🎵 Música y conciertos",
    clases: "text-musica bg-musica/15",
  },
  deportes: {
    nombre: "Deportes",
    nombreLargo: "⚽ Deportes",
    clases: "text-deportes bg-deportes/15",
  },
  cultura: {
    nombre: "Cultura",
    nombreLargo: "🎭 Cultura y teatro",
    clases: "text-cultura bg-cultura/15",
  },
  tecnologia: {
    nombre: "Tecnología",
    nombreLargo: "💻 Tecnología, meetups y negocios",
    clases: "text-tecnologia bg-tecnologia/15",
  },
  bienestar: {
    nombre: "Bienestar",
    nombreLargo: "🧘 Bienestar y actividad física",
    clases: "text-bienestar bg-bienestar/15",
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
