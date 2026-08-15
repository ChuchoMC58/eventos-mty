import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent, Category } from "@/lib/events/types";

// Luma (antes lu.ma) es la herramienta con la que un venue chico, un meetup o un
// sello independiente publica lo suyo: inventario que no existe en ninguna
// boletera y que Ticketmaster estructuralmente no puede traer. Ver FUENTES.md.
//
// La API del discover no está documentada ni versionada (es la que consume su
// propio front), así que el conector asume que puede cambiar sin aviso.
const API = "https://api.luma.com/discover/get-paginated-events";
const UA = "eventos-mty/1.0 (+https://github.com/ChuchoMC58/eventos-mty)";

// Sin coordenadas explícitas la API geolocaliza POR IP, y el VPS aterriza en
// Boston: el cron traería eventos de Massachusetts sin ningún error visible.
const MONTERREY = { latitude: "25.6866", longitude: "-100.3161" };

// Luma tiene 8 categorías fijas en toda la plataforma y ninguna es música ni
// deportes: los conciertos viven dentro de Arts & Culture.
//
// El mapeo a nuestro modelo vive AQUÍ, en el conector, no en CATEGORIES: el
// modelo es nuestro, no de Luma. Si mañana entra otra fuente con su propia
// taxonomía, hace lo mismo por su lado.
interface CategoriaLuma {
  id: string;
  /** Como la llama la fuente. Se conserva en `tags`. */
  nombre: string;
  categoria: Category;
  /**
   * Hoy no trae ni un evento en Monterrey, así que su destino se decidió con
   * una muestra del feed global (ver FUENTES.md). El día que traiga
   * algo hay que confirmarlo con casos reales → `avisoProvisional()`.
   */
  provisional?: boolean;
}

const ARTS = "arts & culture";

const CATEGORIAS_LUMA: CategoriaLuma[] = [
  { id: "cat-AzVAf6VmE9JEre4", nombre: ARTS, categoria: "cultura" },
  { id: "cat-tech", nombre: "tech", categoria: "tecnologia" },
  { id: "cat-ai", nombre: "ai", categoria: "tecnologia" },
  { id: "cat-crypto", nombre: "crypto", categoria: "tecnologia" },
  { id: "cat-0Km9ZnuBjFAjwFl", nombre: "fitness", categoria: "bienestar" },
  { id: "cat-C1VaNLnt25w9t6c", nombre: "wellness", categoria: "bienestar" },
  // Climate resultó ser una industria, no un tema: ~3 de cada 4 de la muestra
  // son demo days, summits e inversión en energía, o sea un meetup de industria.
  { id: "cat-climate", nombre: "climate", categoria: "tecnologia", provisional: true },
  // El destino menos malo mientras no haya casos: una cata se parece a salir.
  { id: "cat-fooddrink", nombre: "food & drink", categoria: "cultura", provisional: true },
];

// Un evento puede salir en varias categorías a la vez (medido: 2 de 19 salen en
// Fitness *y* Wellness). Sin una prioridad explícita su categoría dependería del
// orden de los `for`, que es la clase de bug que nadie nota. Se ordena por lo
// específico: música es lo más concreto, tecnología el cajón más ancho.
const PRIORIDAD: Category[] = ["musica", "cultura", "bienestar", "tecnologia"];

const MAX_PAGINAS = 20; // si el parámetro del cursor cambia de nombre, el bucle giraría infinito

// El área de Monterrey abarca varios municipios (San Pedro, Apodaca, San Nicolás,
// Santa Catarina, Allende…). Todos son la misma cartelera, pero el estado sí
// tiene que ser Nuevo León: es el canario de que las coordenadas se aplicaron.
const REGION = /nuevo le[óo]n/i;

// Dentro de Arts & Culture hay conciertos y talleres mezclados; sin heurística
// toda la música se perdería en "cultura".
const ES_MUSICA =
  /concierto|en vivo|live|listening party|full band|ac[úu]stic|dj\b|banda|tocada|showcase|tour\b|recital|jam\b/i;

// Sólo para lo que Luma no clasifica en ninguna categoría: sin esto, el único
// caso real medido (un club de correr) caía en `cultura` por descarte.
const ES_BIENESTAR =
  /\brun\b|running|rodada|yoga|pilates|marat[óo]n|caminata|entrenamiento|workout|crossfit|spinning|medita/i;

interface LumaGeo {
  mode?: string;
  address?: string;
  short_address?: string;
  sublocality?: string;
  city?: string;
  region?: string;
  localized?: Record<string, Partial<LumaGeo>>;
}

interface LumaEvent {
  api_id?: string;
  name?: string;
  url?: string; // es el slug, no una URL
  cover_url?: string;
  start_at?: string;
  end_at?: string;
  geo_address_info?: LumaGeo;
}

interface LumaTicketInfo {
  is_free?: boolean;
  is_sold_out?: boolean;
  price?: { cents?: number | null; currency?: string | null } | null;
  max_price?: { cents?: number | null; currency?: string | null } | null;
}

export interface LumaEntry {
  event?: LumaEvent;
  ticket_info?: LumaTicketInfo;
}

interface LumaPage {
  entries?: LumaEntry[];
  has_more?: boolean;
  next_cursor?: string | null;
}

function pesos(monto?: { cents?: number | null; currency?: string | null } | null): number | undefined {
  if (!monto?.cents) return undefined;
  // Sólo confiamos en MXN: un precio en USD mostrado como "$" mentiría en la cartelera.
  if (monto.currency && monto.currency.toLowerCase() !== "mxn") return undefined;
  return Math.round(monto.cents / 100);
}

/**
 * A qué categoría nuestra va un evento, sabiendo en qué categorías de Luma salió.
 * `nombres` vacío = Luma no lo clasifica en ninguna (medido: 1 de 19).
 */
export function categoriaDe(nombres: string[], titulo: string): Category {
  const candidatas = new Set<Category>();
  for (const n of nombres) {
    const c = CATEGORIAS_LUMA.find((x) => x.nombre === n);
    if (c) candidatas.add(c.categoria);
  }

  // La heurística de música sólo corre donde la música puede estar: dentro de
  // Arts & Culture (Luma no tiene categoría de música) y en lo que no trae
  // ninguna. Aplicarla a todo convertiría un "Startup Showcase" en un concierto.
  if ((candidatas.size === 0 || nombres.includes(ARTS)) && ES_MUSICA.test(titulo)) {
    candidatas.add("musica");
  }

  // Lo que la fuente no clasifica se adivina por el título, no se manda a
  // `cultura` por descarte: el único caso real medido era un club de correr.
  if (candidatas.size === 0 && ES_BIENESTAR.test(titulo)) candidatas.add("bienestar");

  // Y si ni así, `cultura`, que es el cajón de "salir". No se pierde en
  // silencio: el conector avisa de cada evento que llega hasta aquí.
  return PRIORIDAD.find((c) => candidatas.has(c)) ?? "cultura";
}

export function mapLumaEntry(entry: LumaEntry, categorias: string[] = []): NormalizedEvent | null {
  const e = entry.event;
  if (!e?.name || !e.start_at || !e.url) return null;

  const geo = e.geo_address_info;
  // Luma esconde la dirección hasta que te registras (~22% de los eventos). Sin
  // nombre de sede real todos colapsarían en un mismo Venue falso y el dedupe
  // (venue + día + título similar) empezaría a fusionar eventos sin relación.
  if (geo?.mode !== "shown") return null;
  if (geo.region && !REGION.test(geo.region)) return null;

  // La app está en español y el bloque localizado trae los mismos campos ya
  // traducidos. Y ojo: el NOMBRE de la sede está en `address` — la calle es
  // `short_address`, no al revés.
  const es = geo.localized?.es ?? {};
  const sede = (es.address ?? geo.address ?? "").trim();
  const ciudad = (es.city ?? geo.city ?? "").trim();
  if (!sede) return null;
  if (ciudad && sede.toLowerCase() === ciudad.toLowerCase()) return null; // "sede" que es una ciudad: no es una sede

  const startsAt = new Date(e.start_at); // ISO UTC con Z: se parsea directo
  if (isNaN(startsAt.getTime())) return null;
  const endsAt = e.end_at ? new Date(e.end_at) : null;
  // Un curso de varias semanas publica una sola entrada con el fin de la última
  // sesión. Guardarlo tal cual haría un evento de 25 días en el calendario y en
  // el ICS; mejor sin hora de fin que con una falsa.
  const finRazonable =
    endsAt !== null &&
    !isNaN(endsAt.getTime()) &&
    endsAt > startsAt &&
    endsAt.getTime() - startsAt.getTime() <= 24 * 3_600_000;

  const t = entry.ticket_info;
  const category = categoriaDe(categorias, `${e.name} ${sede}`);
  const tags = [...categorias];
  if (t?.is_sold_out) tags.push("agotado"); // agotado ≠ cancelado: el evento sigue en pie

  return {
    title: e.name.trim(),
    startsAt,
    endsAt: finRazonable ? endsAt! : undefined,
    category,
    tags,
    // is_free es un dato real (0), no un "no sé" (undefined).
    priceMin: t?.is_free ? 0 : pesos(t?.price),
    priceMax: t?.is_free ? undefined : pesos(t?.max_price),
    ticketUrl: `https://luma.com/${e.url}`,
    imageUrl: e.cover_url,
    status: "activo",
    venue: {
      name: sede,
      address: (es.short_address ?? geo.short_address)?.trim(),
      zone: (es.sublocality ?? geo.sublocality)?.trim(),
    },
    city: "monterrey", // el área es metropolitana; geo.city trae el municipio
  };
}

/** Una consulta al discover, paginada. `categoriaId` vacío = el feed sin filtro. */
async function pedirPaginas(fetchFn: typeof fetch, categoriaId?: string): Promise<LumaEntry[]> {
  const entries: LumaEntry[] = [];
  let cursor: string | null = null;

  // El tope de páginas es POR consulta, no para el barrido entero: si una
  // categoría se atora, no debe consumirse el presupuesto de las demás.
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const qs = new URLSearchParams({ ...MONTERREY });
    if (categoriaId) qs.set("discover_category_api_id", categoriaId);
    // El parámetro se llama pagination_cursor; el campo de la respuesta,
    // next_cursor. Mandar next_cursor= devuelve la página 1 otra vez, con 200
    // y sin aviso — un bucle escrito así gira para siempre.
    if (cursor) qs.set("pagination_cursor", cursor);
    const res = await fetchFn(`${API}?${qs}`, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`Luma HTTP ${res.status}`);
    const data = (await res.json()) as LumaPage;
    entries.push(...(data.entries ?? []));
    if (!data.has_more || !data.next_cursor || data.next_cursor === cursor) break;
    cursor = data.next_cursor;
  }
  return entries;
}

/** Una entrada única del barrido y en qué categorías de Luma apareció. */
interface Vista {
  entry: LumaEntry;
  categorias: string[];
}

export function lumaConnector(fetchFn: typeof fetch = fetch): Connector {
  return {
    slug: "luma",
    name: "Luma Monterrey",
    minExpected: 2, // fuente chica (~15 eventos en el área): el umbral global de 5 no la protegería
    async fetchEvents() {
      // El listado NO dice a qué categoría pertenece cada evento (eso sólo está
      // en el detalle, ~160 KB por evento), así que la única forma de saberlo es
      // recordar a qué endpoint se le preguntó.
      const vistos = new Map<string, Vista>();
      let recibidos = 0;

      // El feed SIN filtro va al final: los que ya salieron por categoría
      // conservan la suya, y lo que sólo aparece aquí es lo que Luma no clasifica
      // (medido: 1 de 19). Sin esta pasada se perdería sin dejar rastro.
      for (const c of [...CATEGORIAS_LUMA, null]) {
        const entries = await pedirPaginas(fetchFn, c?.id);
        recibidos += entries.length;
        for (const entry of entries) {
          const clave = entry.event?.api_id ?? entry.event?.url;
          if (!clave) continue;
          const vista = vistos.get(clave);
          if (!vista) vistos.set(clave, { entry, categorias: c ? [c.nombre] : [] });
          else if (c) vista.categorias.push(c.nombre);
        }
      }

      // Si llegaron eventos pero TODOS son de fuera de Nuevo León, las
      // coordenadas se ignoraron y estamos viendo el feed por IP. Vale más
      // reventar que ingerir la cartelera de Boston.
      //
      // El corte se mide sobre el barrido completo, no consulta por consulta:
      // las coordenadas se ignoran para todas por igual, y una categoría chica
      // que devuelva un solo evento de Saltillo no es señal de nada.
      const enNuevoLeon = [...vistos.values()].filter((v) => {
        const region = v.entry.event?.geo_address_info?.region;
        return !region || REGION.test(region);
      });
      if (recibidos > 0 && enNuevoLeon.length === 0) {
        throw new Error("Luma: ningún evento en Nuevo León (¿se ignoraron las coordenadas?)");
      }

      const mapeados = enNuevoLeon
        .map((v) => ({ vista: v, evento: mapLumaEntry(v.entry, v.categorias) }))
        .filter((x): x is { vista: Vista; evento: NormalizedEvent } => x.evento !== null);

      avisos(mapeados);
      return mapeados.map((x) => x.evento);
    },
  };
}

/**
 * Lo que se decidió a ciegas tiene que hacer ruido la primera vez que toque un
 * caso real. Sale por `console.warn`, que el reporte de ingesta ya imprime.
 */
function avisos(mapeados: Array<{ vista: Vista; evento: NormalizedEvent }>) {
  for (const c of CATEGORIAS_LUMA) {
    if (!c.provisional) continue;
    const suyos = mapeados.filter((x) => x.vista.categorias.includes(c.nombre));
    if (suyos.length === 0) continue;
    console.warn(
      `⚠️  Luma: primeros eventos de "${c.nombre}" (${suyos.length}) → ${c.categoria}. ` +
        `El mapeo era provisional: confírmalo con estos casos (FUENTES.md). ` +
        suyos.map((x) => `«${x.evento.title}»`).join(", "),
    );
  }

  const sinCategoria = mapeados.filter((x) => x.vista.categorias.length === 0);
  if (sinCategoria.length > 0) {
    console.warn(
      `⚠️  Luma: ${sinCategoria.length} evento(s) que la fuente no clasifica, ` +
        `puestos por título: ` +
        sinCategoria.map((x) => `«${x.evento.title}» → ${x.evento.category}`).join(", "),
    );
  }
}
