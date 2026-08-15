import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent, Category } from "@/lib/events/types";
import { fechaZonaAUtc } from "@/lib/ingest/fechas";

/**
 * Fever — Candlelight, experiencias inmersivas, museos y cena-espectáculo. Cero
 * solape con boleteras: nadie más de nuestras fuentes vende esto.
 *
 * Dos etapas, como CONARTE y AREMA:
 *
 *  1. `/es/monterrey` (Astro) sólo se usa para sacar la LISTA de ids. Cada
 *     tarjeta es una isla cuyo `props` trae el plan en JSON escapado como HTML y
 *     con cada valor envuelto en una tupla `[0, valor]`.
 *  2. `/m/<id>` trae el plan de verdad en un `<script id="astro-tools-transfer-state">`
 *     que es JSON limpio: `page-config.planDetail` (ciudad, sede con dirección,
 *     categorías, descripción, precio) y `ticket-selector-config.transferState`
 *     (las FUNCIONES reales o el calendario de disponibilidad).
 *
 * Por qué la etapa 2 no es opcional: en la home `startDate`/`endDate` son un
 * RANGO ("El Laberinto de Tim Burton" del 6 al 16 de agosto en un solo plan), no
 * una función. Publicar sólo el rango pondría el evento el día del estreno y lo
 * desaparecería el resto de la corrida. La página del plan sí trae las fechas.
 *
 * Ver FUENTES.md para el reconocimiento completo.
 */
const HOME = "https://feverup.com/es/monterrey";
const PLAN = (id: number) => `https://feverup.com/m/${id}`;
const UA = "eventos-mty/1.0 (+https://github.com/ChuchoMC58/eventos-mty)";

const TZ = "America/Monterrey";
const CITY_SLUG = "monterrey"; // `planDetail.citySlug`, no el nombre de la sede
const DETALLES_EN_PARALELO = 4;

/** Un evento de hoy que ya empezó sigue valiendo; el de ayer no. */
const GRACIA_PASADO_MS = 12 * 3600_000;

/**
 * Piso de eventos cuando la home viene sana. `hayCaida()` sólo ve la caída a
 * CERO; un colapso parcial —49 planes en la home y 3 eventos porque cambió el
 * árbol del selector— le es invisible. Eso lo detecta el conector (regla 1).
 */
const PLANES_SANO = 30;
const MIN_EVENTOS = 15;

/** Hora de arranque cuando el plan no dice ninguna. Casi nunca se usa. */
const HORA_POR_DEFECTO = "12:00";

/**
 * A partir de aquí un plan deja de ser "funciones sueltas" y se trata como
 * corrida continua, aunque Fever no lo marque como calendario: el "Nuevo León
 * City Tour Hop On/Hop Off" sale todos los días y publicaba 10 renglones
 * idénticos en la cartelera. Los Candlelight, que son el caso que sí queremos
 * expandir, no pasan de 3 fechas; el Jazz Room, de 4.
 */
const MAX_DIAS_SUELTOS = 6;

// ── Etapa 1: la home ────────────────────────────────────────────────────────

/**
 * Astro envuelve **cada valor** en una tupla `[tag, valor]`: `0` es un valor
 * suelto y `1` un arreglo. Sin desenvolverlo, `plan.id` es `[0, 587490]`.
 */
function desenvolver(v: unknown): unknown {
  if (Array.isArray(v)) {
    if (v.length === 2 && typeof v[0] === "number") {
      return v[0] === 1 ? ((v[1] as unknown[]) ?? []).map(desenvolver) : desenvolver(v[1]);
    }
    return v.map(desenvolver);
  }
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, desenvolver(x)]));
  }
  return v;
}

function desescapar(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // al final: "&amp;quot;" debe quedar en "&quot;", no en '"'
}

export interface PlanEnHome {
  id: number;
  /** Tarjeta de regalo o entrada sin fecha fija: no es un evento. */
  isTimeless: boolean;
}

/**
 * De la home saca los ids. `isTimeless` se lee aquí sólo para AHORRARSE la
 * petición del detalle: son 13 de 49 planes que de todos modos se descartarían.
 * El filtro que manda es el de `mapPlan`, sobre el detalle.
 */
export function planesEnHome(html: string): PlanEnHome[] {
  const vistos = new Map<number, PlanEnHome>();
  for (const [, crudo] of html.matchAll(/props="([^"]*)"/g)) {
    let isla: unknown;
    try {
      isla = desenvolver(JSON.parse(desescapar(crudo)));
    } catch {
      continue; // hay islas que no son tarjetas; que una no parsee no es noticia
    }
    const plan = (isla as { plan?: { id?: unknown; isTimeless?: unknown } })?.plan;
    if (typeof plan?.id !== "number") continue;
    if (!vistos.has(plan.id)) vistos.set(plan.id, { id: plan.id, isTimeless: plan.isTimeless === true });
  }
  return [...vistos.values()];
}

// ── Etapa 2: la página del plan ─────────────────────────────────────────────

/** Un renglón del calendario de disponibilidad de un plan de temporada. */
interface DiaCalendario {
  fecha: string; // YYYY-MM-DD en la zona del plan
  precioMin?: number;
  agotado: boolean;
}

export interface Funcion {
  startsAt: Date;
  endsAt?: Date;
  precio?: number;
  disponible: boolean;
}

export interface PlanFever {
  id: number;
  title: string;
  citySlug: string;
  isTimeless: boolean;
  /** `standard` es un plan normal; `waitlist` es apuntarse a una lista de espera. */
  tipo: string;
  categoria: string;
  categorias: string[];
  description?: string;
  imageUrl?: string;
  venue?: { name: string; address?: string };
  /**
   * Corrida continua (museo, exposición, juego callejero) en vez de funciones
   * sueltas: el sitio la vende con un calendario de días disponibles.
   */
  esTemporada: boolean;
  precioDesde?: number;
  /** ISO con offset de la primera y última función que siguen a la venta. */
  primeraActiva?: string;
  funciones: Funcion[];
  calendario: DiaCalendario[];
}

interface Nivel {
  items?: { value?: unknown; level?: Nivel | null }[] | null;
}

/**
 * El selector de boletos es un árbol de niveles cuya forma cambia según el
 * plan: `fecha → hora → sesión` en un Candlelight, `hora → sesión` o sólo
 * `sesión` cuando la fecha ya viene fijada. Recorrerlo entero y quedarse con lo
 * que tenga `starts_at_iso` sirve para las tres formas.
 */
function sesionesDelNivel(nivel: Nivel | null | undefined, out: Funcion[] = []): Funcion[] {
  for (const item of nivel?.items ?? []) {
    const v = item?.value as
      | { starts_at_iso?: string; ends_at_iso?: string; price?: number; has_available_tickets?: boolean }
      | undefined;
    if (v && typeof v === "object" && typeof v.starts_at_iso === "string") {
      const startsAt = new Date(v.starts_at_iso);
      if (!Number.isNaN(startsAt.getTime())) {
        const endsAt = v.ends_at_iso ? new Date(v.ends_at_iso) : undefined;
        out.push({
          startsAt,
          endsAt: endsAt && !Number.isNaN(endsAt.getTime()) && endsAt > startsAt ? endsAt : undefined,
          precio: typeof v.price === "number" ? v.price : undefined,
          disponible: v.has_available_tickets !== false,
        });
      }
    }
    if (item?.level) sesionesDelNivel(item.level, out);
  }
  return out;
}

/** `<em>` (escapado dos veces) + entidades + etiquetas → texto plano. */
function texto(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    // Hay descripciones con un <style> adentro: quitar sólo las etiquetas dejaría
    // el CSS como si fuera el texto del evento, y eso fue lo que se publicó del
    // "Super Paquete" de Papalote hasta que se vio en la ficha.
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+)(acute|grave|tilde|uml|circ);/gi, (_, letra: string) => letra)
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#039);/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * La descripción de Fever es copy de marketing de 2 000+ caracteres con emojis,
 * y la ficha del evento la pinta como un solo párrafo. Se corta en la última
 * frase que quepa para no dejarla a media palabra.
 */
const LARGO_DESCRIPCION = 500;
function resumen(s: string): string | undefined {
  const t = texto(s);
  if (t.length <= LARGO_DESCRIPCION) return t || undefined;
  const cortado = t.slice(0, LARGO_DESCRIPCION);
  const fin = Math.max(cortado.lastIndexOf(". "), cortado.lastIndexOf("! "), cortado.lastIndexOf("? "));
  return (fin > LARGO_DESCRIPCION / 2 ? cortado.slice(0, fin + 1) : `${cortado.trimEnd()}…`).trim();
}

/**
 * `<script id="astro-tools-transfer-state">` es JSON limpio —sin tuplas ni
 * entidades—, al revés que las islas de la home.
 */
export function parsePaginaPlan(html: string, id: number): PlanFever | null {
  const crudo = html.match(
    /<script id="astro-tools-transfer-state" type="application\/json">([\s\S]*?)<\/script>/,
  )?.[1];
  if (!crudo) return null;

  let estado: {
    "page-config"?: { planDetail?: Record<string, unknown> };
    "ticket-selector-config"?: { transferState?: Record<string, unknown> };
  };
  try {
    estado = JSON.parse(crudo);
  } catch {
    return null;
  }
  const pd = estado["page-config"]?.planDetail;
  if (!pd || typeof pd.name !== "string") return null;

  const funciones: Funcion[] = [];
  const calendario: DiaCalendario[] = [];
  for (const [clave, valor] of Object.entries(estado["ticket-selector-config"]?.transferState ?? {})) {
    if (clave.startsWith("LevelTicketSelectorLoader.")) {
      sesionesDelNivel((valor as { level?: Nivel })?.level, funciones);
    }
    if (clave.startsWith("PlanCalendarSelectorService.getCalendarAvailability")) {
      const dias = (valor as { dates?: Record<string, { status?: string; minTicketPrice?: number }> })?.dates ?? {};
      for (const [fecha, info] of Object.entries(dias)) {
        calendario.push({
          fecha,
          precioMin: typeof info?.minTicketPrice === "number" ? info.minTicketPrice : undefined,
          // "low" es "quedan pocos", no "no hay"; el único estado que descarta
          // un día es `sold_out` (La Odisea IMAX tiene agotadas las dos primeras
          // semanas y su primer día real es el 22).
          agotado: info?.status === "sold_out",
        });
      }
    }
  }

  const lugar = (pd.defaultPlace ?? (pd.places as unknown[] | undefined)?.[0]) as
    | { name?: string; address?: string }
    | undefined;
  const precio = pd.priceInfo as { amount?: number } | undefined;

  return {
    id,
    title: texto(String(pd.name)),
    citySlug: typeof pd.citySlug === "string" ? pd.citySlug : "",
    isTimeless: pd.isTimeless === true,
    tipo: typeof pd.type === "string" ? pd.type : "standard",
    categoria: typeof pd.category === "string" ? pd.category : "",
    categorias: Array.isArray(pd.categories) ? pd.categories.map((c) => texto(String(c))) : [],
    description: typeof pd.description === "string" ? resumen(pd.description) : undefined,
    imageUrl: typeof pd.coverImage === "string" ? pd.coverImage : undefined,
    venue: lugar?.name ? { name: texto(lugar.name), address: lugar.address ? texto(lugar.address) : undefined } : undefined,
    esTemporada: pd.isCalendarSelector === true,
    precioDesde: typeof precio?.amount === "number" ? precio.amount : undefined,
    primeraActiva: typeof pd.firstActiveSessionDate === "string" ? pd.firstActiveSessionDate : undefined,
    funciones: funciones.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    calendario: calendario.sort((a, b) => a.fecha.localeCompare(b.fecha)),
  };
}

// ── Categorías ──────────────────────────────────────────────────────────────

/**
 * La taxonomía es de Fever, no nuestra (regla 3). `category` es su cajón
 * principal y `categories` la lista larga en inglés.
 *
 * `mix` es literalmente su cajón de sastre (una comedia con vino, un juego
 * callejero y un escape room caen ahí), así que va a `cultura`, que es el
 * nuestro. Y `nightlife` no es fiesta: es donde meten los Candlelight.
 */
const CATEGORIAS: Record<string, Category> = {
  concert: "musica",
  nightlife: "musica",
  cinema: "cultura",
  theater: "cultura",
  tourism: "cultura",
  mix: "cultura",
  sport: "deportes",
};

/** Marcas de música en `categories` para cuando `category` viene vacía. */
const MUSICA = /^(concert|candlelight concert|musical event|music genre|jazz|rock|dj party|small gig|classical music)$/i;
const DEPORTE = /^(sports?|fun sports)$/i;

export function categoryFrom(plan: Pick<PlanFever, "categoria" | "categorias">): Category {
  const directa = CATEGORIAS[plan.categoria.trim().toLowerCase()];
  if (directa) return directa;
  // 8 de los 49 planes traen `category` vacía —cuatro de ellos Candlelight—, así
  // que sin este segundo intento se irían a cultura siendo conciertos.
  if (plan.categorias.some((c) => MUSICA.test(c.trim()))) return "musica";
  if (plan.categorias.some((c) => DEPORTE.test(c.trim()))) return "deportes";
  return "cultura";
}

// ── De plan a eventos ───────────────────────────────────────────────────────

const DIA_MTY = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
/** "YYYY-MM-DD" del día en Monterrey, no en la TZ del proceso. */
function diaEnMonterrey(d: Date): string {
  return DIA_MTY.format(d);
}

function horaDe(iso: string): string | undefined {
  return iso.match(/T(\d{2}:\d{2})/)?.[1];
}

/**
 * Un plan de temporada se publica como UN evento en su próximo día disponible,
 * no uno por día: "Papalote Museo del Niño + Expo Dinosaurios" abre 25 días
 * seguidos y publicarlos todos sería inundar la cartelera con el mismo título.
 * Como la ingesta corre a diario, la fecha se va recorriendo sola.
 */
function eventoDeTemporada(plan: PlanFever, hoy: string): Funcion | null {
  const dia = plan.calendario.find((d) => !d.agotado && d.fecha >= hoy);
  if (!dia) {
    // Sin calendario legible queda la primera función activa del propio plan:
    // degradarse a un evento es mejor que perderlo entero.
    if (!plan.primeraActiva) return null;
    const startsAt = new Date(plan.primeraActiva);
    return Number.isNaN(startsAt.getTime()) ? null : { startsAt, disponible: true };
  }

  // La hora sale del selector que la página trae precargado para ese día; si no
  // coincide, de la primera función activa; y si tampoco, de un default.
  const delDia = plan.funciones.filter((f) => diaEnMonterrey(f.startsAt) === dia.fecha);
  if (delDia.length > 0) {
    return { ...delDia[0], precio: delDia[0].precio ?? dia.precioMin };
  }
  const hora = (plan.primeraActiva && horaDe(plan.primeraActiva)) || HORA_POR_DEFECTO;
  const startsAt = fechaZonaAUtc(`${dia.fecha}T${hora}`, TZ);
  return startsAt ? { startsAt, precio: dia.precioMin, disponible: true } : null;
}

export function mapPlan(plan: PlanFever, ahora: Date = new Date()): NormalizedEvent[] {
  // Los tres filtros que separan los ~34 planes publicables de los 49 de la home.
  if (plan.isTimeless) return []; // tarjetas de regalo y entradas sin fecha fija
  if (plan.citySlug !== CITY_SLUG) return []; // se cuelan planes de otras ciudades
  if (plan.tipo !== "standard") return []; // `waitlist`: no es un evento, es apuntarse
  if (!plan.venue?.name || !plan.title) return [];

  const hoy = diaEnMonterrey(ahora);

  let funciones: Funcion[];
  if (plan.esTemporada) {
    const una = eventoDeTemporada(plan, hoy);
    funciones = una ? [una] : [];
  } else {
    // Un día entero agotado no se publica; pero si el plan no marca
    // disponibilidad en ninguna, se publica igual (el dato falta, no es un "no").
    const conCupo = plan.funciones.filter((f) => f.disponible);
    funciones = conCupo.length > 0 ? conCupo : plan.funciones;
    if (funciones.length === 0 && plan.primeraActiva) {
      const startsAt = new Date(plan.primeraActiva);
      if (!Number.isNaN(startsAt.getTime())) funciones = [{ startsAt, disponible: true }];
    }
  }

  // Una función por DÍA: las dos del mismo Candlelight (19:00 y 21:00) las
  // fusionaría igual el dedupe (venue + día + título), así que se manda una sola
  // con el precio más barato del día.
  const porDia = new Map<string, Funcion[]>();
  for (const f of funciones) {
    const dia = diaEnMonterrey(f.startsAt);
    porDia.set(dia, [...(porDia.get(dia) ?? []), f]);
  }

  const corte = ahora.getTime() - GRACIA_PASADO_MS;
  // De cada día, la primera función que no haya pasado. Un día cuyas funciones
  // ya pasaron entero no se publica.
  const dias = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, fs]) => ({
      todas: fs,
      primera: fs
        .filter((f) => f.startsAt.getTime() >= corte)
        .reduce<Funcion | null>((a, b) => (a && a.startsAt <= b.startsAt ? a : b), null),
    }))
    .filter((d): d is { todas: Funcion[]; primera: Funcion } => d.primera !== null);
  // Ya venía reducido a uno si `esTemporada`; esto atrapa al que corre a diario
  // sin que Fever lo marque como calendario.
  const aPublicar = dias.length > MAX_DIAS_SUELTOS ? dias.slice(0, 1) : dias;

  const category = categoryFrom(plan);
  const eventos: NormalizedEvent[] = [];
  for (const { todas: delDia, primera } of aPublicar) {
    const precios = delDia.map((f) => f.precio).filter((p): p is number => typeof p === "number");
    // El precio de Fever es un "desde" (la zona más barata, sin cargo por
    // servicio): va en priceMin. El máximo sólo si hay varias zonas ese día.
    const priceMin = precios.length > 0 ? Math.min(...precios) : plan.precioDesde;
    const priceMax = precios.length > 0 ? Math.max(...precios) : undefined;
    eventos.push({
      title: plan.title,
      description: plan.description,
      startsAt: primera.startsAt,
      endsAt: primera.endsAt,
      category,
      // Las `categories` de Fever son etiquetas en inglés de su taxonomía
      // ("Scavenger Hunt", "Small Gig"); el matcher del digest las compara con
      // texto libre en español, así que no le sirven de nada.
      tags: [],
      priceMin,
      priceMax: priceMax !== undefined && priceMax !== priceMin ? priceMax : undefined,
      ticketUrl: PLAN(plan.id),
      imageUrl: plan.imageUrl,
      status: "activo", // el sitio no expone cancelaciones: un plan cancelado desaparece
      venue: { name: plan.venue.name, address: plan.venue.address },
      city: "monterrey",
    });
  }
  return eventos;
}

async function enTandas<T, R>(items: T[], tam: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += tam) {
    out.push(...(await Promise.all(items.slice(i, i + tam).map(fn))));
  }
  return out;
}

export function feverConnector(fetchFn: typeof fetch = fetch, ahora?: () => Date): Connector {
  const now = ahora ?? (() => new Date());

  return {
    slug: "fever",
    name: "Fever",
    async fetchEvents() {
      const pedir = (url: string) => fetchFn(url, { headers: { "user-agent": UA } });

      const res = await pedir(HOME);
      if (!res.ok) throw new Error(`Fever home HTTP ${res.status}`);
      const planes = planesEnHome(await res.text());
      // La home responde 200 aunque cambie el markup: sin esto, un rediseño de
      // Astro apagaría la fuente en silencio (regla 1).
      if (planes.length === 0) {
        throw new Error("Fever: la home no soltó ni un plan (¿cambió el markup de las islas?)");
      }

      const aPedir = planes.filter((p) => !p.isTimeless);
      let sinLeer = 0;
      const detalles = await enTandas(aPedir, DETALLES_EN_PARALELO, async (p) => {
        try {
          const r = await pedir(PLAN(p.id));
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const plan = parsePaginaPlan(await r.text(), p.id);
          if (!plan) throw new Error("sin transfer-state legible");
          return plan;
        } catch {
          sinLeer++;
          return null;
        }
      });

      if (aPedir.length > 0 && detalles.every((d) => d === null)) {
        throw new Error(`Fever: ninguno de los ${aPedir.length} planes se pudo leer`);
      }

      const eventos = detalles.flatMap((d) => (d ? mapPlan(d, now()) : []));

      if (planes.length >= PLANES_SANO && eventos.length < MIN_EVENTOS) {
        throw new Error(
          `Fever: ${planes.length} planes en la home pero sólo ${eventos.length} eventos ` +
            `(${aPedir.length} con detalle) — ¿cambió el selector de boletos?`,
        );
      }

      if (sinLeer > 0) {
        console.warn(`[fever] ${sinLeer} de ${aPedir.length} planes sin detalle legible: se pierden esos eventos`);
      }
      return eventos;
    },
  };
}
