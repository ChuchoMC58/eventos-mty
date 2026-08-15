import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent, Category } from "@/lib/events/types";

/**
 * AREMA Ticket — la boletera de los venues chicos del área metropolitana:
 * Auditorio Río 70, Café Iguana, Jardín 85, Dramático, los Zagar Comedy Bar y
 * el Teatro de la Ciudad. Casi nada de esto lo ve ninguna de nuestras otras
 * fuentes, y aporta la única masa real de comedia del catálogo.
 *
 * No se scrapea: su front (React) habla con dos endpoints JSON sin
 * autenticación. Ver FUENTES.md para el reconocimiento completo.
 */
const API = "https://t3lb.arema.mx/public";
const WEB = "https://arema.mx";
const CDN = "https://cdn.arema.dev/t3/events";
const UA = "eventos-mty/1.0 (+https://github.com/ChuchoMC58/eventos-mty)";

const ESTADO = "Nuevo León";
const DETALLES_EN_PARALELO = 4;

/** Un evento de hoy que ya empezó sigue valiendo; el de ayer no. */
const GRACIA_PASADO_MS = 12 * 3600_000;

/**
 * Piso de vigentes en NL cuando el catálogo nacional viene sano. `hayCaida()`
 * sólo ve la caída a CERO; un colapso parcial —96 → 4 porque renombraron
 * `state`— le es invisible. Eso lo detecta el conector (regla 1 de FUENTES.md).
 */
const MIN_VIGENTES = 20;
const CATALOGO_SANO = 300;

interface AremaEvento {
  event_id?: number;
  event_name?: string;
  category_name?: string | null;
  /** Epoch en SEGUNDOS y en UTC de verdad: 1786104000 = 20:00 en Monterrey. */
  date?: number;
  venue_name?: string;
  city?: string | null;
  state?: string | null;
}

interface AremaFecha {
  date?: number;
  active?: boolean;
}

interface AremaDetalle {
  sinopsis?: string | null;
  dates?: AremaFecha[] | null;
}

/**
 * `events/list` trae UNA fecha por evento —la primera función— aunque la obra
 * tenga temporada. En la muestra del reconocimiento, 6 de 14 tenían más de una:
 * "Gran Feria Nuevo León" tiene 10. Sin la etapa 2 se publicaría el estreno y se
 * perdería el resto de la temporada.
 */
interface AremaListado {
  events?: AremaEvento[];
}

/** La API responde HTTP 200 hasta cuando falla; el error va en el cuerpo. */
interface Sobre<T> {
  error?: boolean;
  code?: string;
  message?: string;
  data?: T;
}

/**
 * Las categorías son las suyas, no las nuestras (regla 3). "Especiales" y
 * "Familiares" son cajones de marketing —ahí caen un rodeo, un drag tour y una
 * feria—, así que van a `cultura`, que es el cajón equivalente del nuestro.
 */
const CATEGORIAS: Record<string, Category> = {
  concierto: "musica",
  teatro: "cultura",
  comediantes: "cultura",
  familiares: "cultura",
  conferencia: "cultura",
  especiales: "cultura",
  deportes: "deportes",
};

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * La `sinopsis` de AREMA no es prosa: es una ficha con el mismo formato en 114
 * de las 115 vigentes al 2026-08-14 \u2014`Fecha:`, `Hora:`, `Lugar:`, `Direcci\u00f3n
 * del evento:`, `Zonas y Precios:` y `Puntos de venta oficiales:`\u2014, y ah\u00ed viven
 * los dos datos que su API JSON no expone en ning\u00fan campo: **el precio y la
 * direcci\u00f3n**. Sin esto la fuente publica 147 de 150 eventos sin precio (los
 * \u00fanicos tres que lo tra\u00edan ven\u00edan de otra fuente por dedupe) y sus 35 recintos
 * propios sin direcci\u00f3n.
 *
 * NO se parsea la fecha ni la hora: `dates[]` las trae en epoch y son
 * correctas; la ficha las repite en espa\u00f1ol y en formatos que no coinciden
 * ("Del Viernes 17 de Julio al Domingo 16 de Agosto"). Reparsear texto para
 * pisar un dato estructurado que ya est\u00e1 bien s\u00f3lo agrega formas de romperlo.
 */
const FICHA = {
  /** D\u00f3nde empieza el bloque de precios. Tambi\u00e9n "Zonas y costos", "Localidades". */
  inicio: /^(zonas?\s*(?:y|de)\s*(?:precios?|costos?)|localidades|precios?|costos?)\s*:/i,
  /** \u2026y d\u00f3nde termina: la secci\u00f3n siguiente, que trae direcciones y prosa con cifras. */
  fin: /^(puntos de venta|sinopsis|importante|observaciones|elenco|nota|acerca|reparto|descripci|bases|whatsapp|en caso)/i,
  /** Un precio de grupo sin cupo indicado: no se sabe a cu\u00e1nto sale por cabeza. */
  grupo: /\bmesas?\b|\bpalcos?\b|\bsalas?\b/i,
  /** "Mesa 4px", "Palco VIP (4 Personas)", "D\u00fao: $499 (2px)". */
  cupo: /\b(\d+)\s*(?:px|personas?)\b/i,
  /** El precio por cabeza que la propia ficha desglosa: "$1,800 ($450 por Persona)". */
  porPersona: /\(\s*\$\s*([\d][\d,.]*)[^)]*por\s+persona/i,
  monto: /\$\s*([\d][\d,.]*)/g,
  direccion: /^[^\S\n]*[*\u2022\s]*direcci[o\u00f3]n(?:\s+del\s+evento)?[\s*]*:[\s*]*(.+?)[\s*]*$/im,
} as const;

/** "$1,400" \u2192 1400. S\u00f3lo cifras con `$`: los desnudos son c\u00f3digos postales y horas. */
const montos = (linea: string) =>
  [...linea.matchAll(FICHA.monto)].map((m) => Number(m[1].replace(/,/g, "").replace(/\.$/, "")));

/**
 * Lo que cuesta entrar **por persona**, que es lo que la cartelera ense\u00f1a. Una
 * mesa de 6 a $2,700 no es un evento de $2,700: son $450, y publicarlo como
 * $2,700 lo saca de cualquier filtro de precio razonable.
 */
function preciosDeLinea(linea: string): number[] {
  // 1) Lo que diga la ficha gana: "Mesa 4px: $500 (por persona)" son $500, no $125.
  const desglosado = linea.match(FICHA.porPersona);
  if (desglosado) return [Number(desglosado[1].replace(/,/g, ""))];
  if (/por\s+persona/i.test(linea)) return montos(linea);
  // 2) Si no, el cupo de la l\u00ednea divide el total.
  const cupo = Number(linea.match(FICHA.cupo)?.[1]);
  if (cupo > 1) return montos(linea).map((n) => Math.round(n / cupo));
  // 3) Y un precio de grupo sin cupo se descarta: inflar\u00eda el m\u00e1ximo con una
  //    cifra que nadie paga por entrar solo.
  if (!cupo && FICHA.grupo.test(linea)) return [];
  return montos(linea);
}

export function parseFicha(sinopsis?: string | null): {
  priceMin?: number;
  priceMax?: number;
  address?: string;
} {
  if (!sinopsis) return {};
  const lineas = sinopsis.split("\n").map((l) => l.replace(/[*\u2022\u00b7]/g, " ").trim());

  // Sin encabezado de precios se arranca en la primera l\u00ednea con "$": hay fichas
  // en prosa ("$450 grada / $600 silla numerada") que si no se perder\u00edan.
  let i = lineas.findIndex((l) => FICHA.inicio.test(l));
  if (i < 0) i = lineas.findIndex((l) => /\$\s*\d/.test(l));

  const precios: number[] = [];
  for (let j = i; j >= 0 && j < lineas.length; j++) {
    if (j > i && FICHA.fin.test(lineas[j])) break;
    precios.push(...preciosDeLinea(lineas[j]));
  }

  const validos = precios.filter((n) => Number.isFinite(n) && n > 0);
  const min = validos.length > 0 ? Math.min(...validos) : undefined;
  const max = validos.length > 0 ? Math.max(...validos) : undefined;

  return {
    priceMin: min,
    // `formatPrecio` ya distingue "desde $X" de un rango; un max igual al min
    // ser\u00eda ruido en la BD.
    priceMax: max !== min ? max : undefined,
    address: sinopsis.match(FICHA.direccion)?.[1] || undefined,
  };
}

/**
 * Al revés que en Superboletos, aquí la música SÍ tiene etiqueta propia y sin
 * ambigüedad ("Concierto"), así que lo que no reconocemos casi nunca es música:
 * el default seguro es `cultura`, no `musica`.
 */
export function categoryFrom(e: AremaEvento): Category {
  return CATEGORIAS[sinAcentos((e.category_name ?? "").trim())] ?? "cultura";
}

/**
 * El dedupe fusiona por venue + día + título similar, y compara el nombre del
 * venue EXACTO. Estos tres los tienen las otras fuentes con otro nombre; sin el
 * alias se crearía un Venue duplicado y el evento se publicaría dos veces.
 *
 * Ojo con la tentación de normalizar por parecido: "Teatro de la Ciudad San
 * Nicolás" es OTRO teatro, en otro municipio, y no debe tocarse. Por eso el
 * mapeo es por nombre exacto y no por regex.
 */
const ALIAS_VENUE: Record<string, string> = {
  // Ticketmaster lo llama por su nombre nuevo desde el patrocinio; son el mismo
  // recinto (Av. Benito Juárez 1002) y TM ya trae 43 eventos suyos.
  "Pabellon M": "Escenario GNP Seguros",
  // Como lo nombran Ticketmaster y CONARTE.
  "Teatro de la Ciudad de Monterrey": "Teatro de la Ciudad",
};

export function mapAremaEvento(
  e: AremaEvento,
  detalle: AremaDetalle | null,
  ahora: Date = new Date(),
): NormalizedEvent[] {
  const title = (e.event_name ?? "").trim();
  const venueName = (e.venue_name ?? "").trim();
  if (!title || !venueName || !e.event_id) return [];

  // Etapa 2 cuando se pudo; si no, la fecha del listado, que siempre es la
  // primera función. Degradarse a un evento es mejor que perderlo entero.
  const activas = (detalle?.dates ?? [])
    .filter((d) => d.active !== false && Number.isFinite(d.date))
    .map((d) => d.date as number);
  const fechas = activas.length > 0 ? activas : Number.isFinite(e.date) ? [e.date as number] : [];

  const ciudad = (e.city ?? "").trim();
  const corte = ahora.getTime() - GRACIA_PASADO_MS;
  // El precio y la dirección sólo existen dentro del texto de la sinopsis: su
  // API no tiene campo para ninguno de los dos.
  const ficha = parseFicha(detalle?.sinopsis);

  const out: NormalizedEvent[] = [];
  for (const ts of [...new Set(fechas)].sort((a, b) => a - b)) {
    const startsAt = new Date(ts * 1000);
    if (startsAt.getTime() < corte) continue;
    out.push({
      title,
      description: detalle?.sinopsis?.trim() || undefined,
      startsAt,
      category: categoryFrom(e),
      tags: [],
      priceMin: ficha.priceMin,
      priceMax: ficha.priceMax,
      // El listado trae `poster: null` en los 96 de NL, pero la imagen existe y
      // su URL es derivable del id: se comprobó 200 en los 96, incluido el único
      // que la búsqueda no devolvía.
      imageUrl: `${CDN}/${e.event_id}/800.webp`,
      ticketUrl: `${WEB}/e/${e.event_id}`,
      status: "activo",
      venue: {
        name: ALIAS_VENUE[venueName] ?? venueName,
        address: ficha.address,
        zone: ciudad && ciudad !== "Monterrey" ? ciudad : undefined,
      },
      city: "monterrey", // el área es metropolitana; el municipio real va en zone
    });
  }
  return out;
}

async function enTandas<T, R>(items: T[], tam: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += tam) {
    out.push(...(await Promise.all(items.slice(i, i + tam).map(fn))));
  }
  return out;
}

export function aremaConnector(fetchFn: typeof fetch = fetch, ahora?: () => Date): Connector {
  const now = ahora ?? (() => new Date());

  /**
   * Los dos endpoints son POST con cuerpo JSON y responden **200 aunque fallen**
   * (`{"error":true,"code":"UNXEND"}` para un endpoint que ya no existe). Mirar
   * sólo el status daría por buena una respuesta vacía y la fuente se apagaría
   * en silencio, que es justo lo que la regla 1 prohíbe.
   */
  async function post<T>(ruta: string, cuerpo: unknown): Promise<T> {
    const res = await fetchFn(`${API}/${ruta}`, {
      method: "POST",
      headers: { "user-agent": UA, "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (!res.ok) throw new Error(`Arema ${ruta} HTTP ${res.status}`);
    const sobre = (await res.json()) as Sobre<T>;
    if (sobre.error || sobre.data === undefined) {
      throw new Error(`Arema ${ruta}: ${sobre.code ?? "sin code"} — ${sobre.message ?? "sin mensaje"}`);
    }
    return sobre.data;
  }

  return {
    slug: "arema",
    name: "AREMA Ticket",
    async fetchEvents() {
      // Un solo POST con cuerpo vacío devuelve el catálogo nacional entero
      // (648 eventos al 2026-08-07), sin paginar. La búsqueda de su sitio
      // (search.arema.io) topa en 50 por consulta y obligaría a inventar
      // términos; esto no.
      const catalogo = (await post<AremaListado>("events/list", {})).events;
      if (!Array.isArray(catalogo) || catalogo.length === 0) {
        throw new Error("Arema: el catálogo vino vacío o no es un arreglo");
      }

      const enNL = catalogo.filter((e) => e.state === ESTADO);

      let sinDetalle = 0;
      const detalles = await enTandas(enNL, DETALLES_EN_PARALELO, async (e) => {
        try {
          return await post<AremaDetalle>("events/get", { event_id: e.event_id });
        } catch {
          // El detalle sólo agrega funciones y sinopsis: si falla, el evento
          // sigue publicándose con la fecha del listado.
          sinDetalle++;
          return null;
        }
      });

      const eventos = enNL.flatMap((e, i) => mapAremaEvento(e, detalles[i], now()));

      if (catalogo.length >= CATALOGO_SANO && eventos.length < MIN_VIGENTES) {
        throw new Error(
          `Arema: catálogo sano (${catalogo.length}) pero sólo ${eventos.length} vigentes en NL ` +
            `(${enNL.length} en el estado) — ¿cambió el esquema?`,
        );
      }

      if (sinDetalle > 0) {
        console.warn(
          `[arema] ${sinDetalle} de ${enNL.length} sin detalle: se publican con la fecha del ` +
            `listado y sin el resto de la temporada`,
        );
      }
      return eventos;
    },
  };
}
