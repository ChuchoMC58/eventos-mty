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
 *  2. La **API REST** del sitio da el plan de verdad, en JSON: el detalle
 *     (`/api/4.4/plans/<id>/`) y, según cómo se venda, sus funciones o su
 *     calendario de días disponibles.
 *
 * Por qué la etapa 2 no es opcional: en la home `startDate`/`endDate` son un
 * RANGO ("El Laberinto de Tim Burton" del 6 al 16 de agosto en un solo plan), no
 * una función. Publicar sólo el rango pondría el evento el día del estreno y lo
 * desaparecería el resto de la corrida. El detalle sí trae las fechas.
 *
 * ⚠️ La etapa 2 se leía del HTML de `/m/<id>`, que era Astro y traía todo en un
 * `<script id="astro-tools-transfer-state">`. Fever migró esa página a **Angular**
 * (2026-08, el script ahora es `serverApp-state` y NO precarga las funciones de
 * los planes con selector de fecha) y el conector se quedó en cero. La API que se
 * usa ahora es la misma que llama ese Angular, así que ya no dependemos de su
 * markup.
 *
 * Ver FUENTES.md para el reconocimiento completo.
 */
const HOME = "https://feverup.com/es/monterrey";
const PLAN = (id: number) => `https://feverup.com/m/${id}`;
const UA = "eventos-mty/1.0 (+https://github.com/ChuchoMC58/eventos-mty)";

/** El detalle va por la 4.4 y la disponibilidad por la 4.2; así las pide el sitio. */
const API_DETALLE = (id: number) => `https://feverup.com/api/4.4/plans/${id}/`;
const API_SESIONES = (id: number, placeId: number) =>
  `https://feverup.com/api/4.2/plans/${id}/place/${placeId}/sessions/?exclude_sessions_as_add_ons=true`;
const API_CALENDARIO = (id: number, placeId: number, desde: string, hasta: string) =>
  `https://feverup.com/api/4.2/plans/${id}/place/${placeId}/availability/?from=${desde}&to=${hasta}`;
const API_SESIONES_DIA = (id: number, placeId: number, dia: string) =>
  `https://feverup.com/api/4.2/plans/${id}/place/${placeId}/sessions_for_date/${dia}/?exclude_sessions_as_add_ons=true`;

/** Ventana del calendario de un plan de temporada: sólo se publica el próximo día. */
const DIAS_CALENDARIO = 60;

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

// ── Etapa 2: la API del plan ────────────────────────────────────────────────

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
  /** El recinto es parte de la ruta de disponibilidad, no sólo un dato del evento. */
  placeId?: number;
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

interface LugarApi {
  id?: number;
  name?: string;
  address?: string;
}

/**
 * `/api/4.4/plans/<id>/` — el detalle, en JSON y en `snake_case` (la página lo
 * traía en `camelCase` porque el Angular ya lo había mapeado). No trae funciones:
 * ésas son otra petición, y cuál depende de `is_calendar_selector`.
 */
export function parsePlanDetalle(json: unknown, id: number): PlanFever | null {
  const pd = json as Record<string, unknown> | null;
  if (!pd || typeof pd !== "object" || typeof pd.name !== "string") return null;

  const lugares = (Array.isArray(pd.places) ? pd.places : []) as LugarApi[];
  const sesionPorDefecto = pd.default_session as { place_id?: number } | undefined;
  // Un plan puede tener varios recintos; el que manda es el de su sesión por
  // defecto, que es el que la página abre.
  const lugar = lugares.find((l) => l.id === sesionPorDefecto?.place_id) ?? lugares[0];
  const precio = pd.price_info as { amount?: number } | undefined;

  return {
    id,
    placeId: typeof lugar?.id === "number" ? lugar.id : undefined,
    title: texto(pd.name),
    citySlug: typeof pd.city_slug === "string" ? pd.city_slug : "",
    isTimeless: pd.is_timeless === true,
    tipo: typeof pd.type === "string" ? pd.type : "standard",
    categoria: typeof pd.category === "string" ? pd.category : "",
    categorias: Array.isArray(pd.categories) ? pd.categories.map((c) => texto(String(c))) : [],
    description: typeof pd.description === "string" ? resumen(pd.description) : undefined,
    imageUrl: portada(pd),
    venue: lugar?.name
      ? { name: texto(lugar.name), address: lugar.address ? texto(lugar.address) : undefined }
      : undefined,
    esTemporada: pd.is_calendar_selector === true,
    precioDesde: typeof precio?.amount === "number" ? precio.amount : undefined,
    primeraActiva: typeof pd.first_active_session_date === "string" ? pd.first_active_session_date : undefined,
    funciones: [],
    calendario: [],
  };
}

/**
 * La portada está marcada por su `role` dentro de `media_gallery`, que también
 * trae vídeos: quedarse con el primer elemento daría un `.mp4` como imagen del
 * evento. `gallery` (sólo fotos) es el respaldo.
 */
function portada(pd: Record<string, unknown>): string | undefined {
  const medios = (Array.isArray(pd.media_gallery) ? pd.media_gallery : []) as {
    media_type?: string;
    url?: string;
    category?: { role?: string };
  }[];
  const cover = medios.find((m) => m.category?.role === "cover_image" && typeof m.url === "string");
  if (cover?.url) return cover.url;
  const fotos = (Array.isArray(pd.gallery) ? pd.gallery : []) as unknown[];
  return typeof fotos[0] === "string" ? fotos[0] : undefined;
}

/** `…/place/<placeId>/sessions/` — el árbol del selector de boletos. */
export function sesionesDeApi(json: unknown): Funcion[] {
  const funciones = sesionesDelNivel((json as { level?: Nivel } | null)?.level);
  return funciones.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** `…/place/<placeId>/availability/` — el calendario de un plan de temporada. */
export function calendarioDeApi(json: unknown): DiaCalendario[] {
  const dias = (json as { dates?: Record<string, { status?: string; min_ticket_price?: number }> } | null)?.dates ?? {};
  return Object.entries(dias)
    .map(([fecha, info]) => ({
      fecha,
      precioMin: typeof info?.min_ticket_price === "number" ? info.min_ticket_price : undefined,
      // "low" es "quedan pocos", no "no hay"; el único estado que descarta un día
      // es `sold_out` (La Odisea IMAX llegó a tener agotadas las dos primeras
      // semanas, y su primer día real era el 22).
      agotado: info?.status === "sold_out",
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
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
export function proximoDiaAbierto(calendario: DiaCalendario[], hoy: string): DiaCalendario | undefined {
  return calendario.find((d) => !d.agotado && d.fecha >= hoy);
}

/**
 * Las funciones de ESE día —todas, para que el precio del evento salga del más
 * barato al más caro como en cualquier otro plan—; el resto del calendario se
 * tira aquí.
 */
function funcionesDeTemporada(plan: PlanFever, hoy: string): Funcion[] {
  const dia = proximoDiaAbierto(plan.calendario, hoy);
  if (!dia) {
    // Sin calendario legible queda la primera función activa del propio plan:
    // degradarse a un evento es mejor que perderlo entero.
    if (!plan.primeraActiva) return [];
    const startsAt = new Date(plan.primeraActiva);
    return Number.isNaN(startsAt.getTime()) ? [] : [{ startsAt, disponible: true }];
  }

  // El calendario da el día y el precio, pero no la hora: ésa sale de las
  // funciones de ese día, que el conector pide aparte. Si faltan, la hora de la
  // primera función activa; y si tampoco, un default.
  const delDia = plan.funciones.filter((f) => diaEnMonterrey(f.startsAt) === dia.fecha);
  if (delDia.length > 0) return delDia;

  const hora = (plan.primeraActiva && horaDe(plan.primeraActiva)) || HORA_POR_DEFECTO;
  const startsAt = fechaZonaAUtc(`${dia.fecha}T${hora}`, TZ);
  return startsAt ? [{ startsAt, precio: dia.precioMin, disponible: true }] : [];
}

/**
 * Los filtros que separan los ~34 planes publicables de los 49 de la home. Se
 * aplican sobre el detalle y ANTES de pedir la disponibilidad: un plan que se va
 * a descartar no merece una segunda petición.
 */
export function esPublicable(plan: PlanFever): plan is PlanFever & { venue: { name: string; address?: string } } {
  if (plan.isTimeless) return false; // tarjetas de regalo y entradas sin fecha fija
  if (plan.citySlug !== CITY_SLUG) return false; // se cuelan planes de otras ciudades
  if (plan.tipo !== "standard") return false; // `waitlist`: no es un evento, es apuntarse
  return Boolean(plan.venue?.name) && Boolean(plan.title);
}

export function mapPlan(plan: PlanFever, ahora: Date = new Date()): NormalizedEvent[] {
  if (!esPublicable(plan)) return [];

  const hoy = diaEnMonterrey(ahora);

  // Un plan de temporada se reduce a las funciones de un solo día; los demás
  // traen las suyas enteras.
  const todas = plan.esTemporada ? funcionesDeTemporada(plan, hoy) : plan.funciones;

  // Un día entero agotado no se publica; pero si el plan no marca disponibilidad
  // en ninguna, se publica igual (el dato falta, no es un "no").
  const conCupo = todas.filter((f) => f.disponible);
  let funciones = conCupo.length > 0 ? conCupo : todas;
  if (funciones.length === 0 && plan.primeraActiva) {
    const startsAt = new Date(plan.primeraActiva);
    if (!Number.isNaN(startsAt.getTime())) funciones = [{ startsAt, disponible: true }];
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

/** "YYYY-MM-DD" de hoy en Monterrey, más `dias`. */
function diaMas(ahora: Date, dias: number): string {
  return diaEnMonterrey(new Date(ahora.getTime() + dias * 86_400_000));
}

export function feverConnector(fetchFn: typeof fetch = fetch, ahora?: () => Date): Connector {
  const now = ahora ?? (() => new Date());

  return {
    slug: "fever",
    name: "Fever",
    async fetchEvents() {
      const pedir = (url: string) =>
        fetchFn(url, { headers: { "user-agent": UA, "accept-language": "es-MX" } });
      const pedirJson = async (url: string) => {
        const r = await pedir(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      };

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
          const plan = parsePlanDetalle(await pedirJson(API_DETALLE(p.id)), p.id);
          if (!plan) throw new Error("detalle sin nombre de plan");
          if (!esPublicable(plan) || !plan.placeId) return plan;

          // Cada forma de venta tiene su endpoint, igual que en el sitio: las
          // funciones sueltas salen del selector de boletos y las corridas
          // continuas del calendario de días. Pedirle el selector a un plan de
          // temporada devuelve disponibilidad que el sitio NO usa (La Odisea
          // aparecía con lugar hoy y el calendario la daba agotada hasta el 21).
          if (plan.esTemporada) {
            const ahoraMismo = now();
            const hoy = diaEnMonterrey(ahoraMismo);
            const calendario = calendarioDeApi(
              await pedirJson(API_CALENDARIO(plan.id, plan.placeId, hoy, diaMas(ahoraMismo, DIAS_CALENDARIO))),
            );
            // El calendario no trae horas. Las del día que se va a publicar —y
            // sólo las de ése— salen de una tercera petición.
            const dia = proximoDiaAbierto(calendario, hoy);
            const funciones = dia
              ? sesionesDeApi(await pedirJson(API_SESIONES_DIA(plan.id, plan.placeId, dia.fecha)))
              : [];
            return { ...plan, calendario, funciones };
          }
          return { ...plan, funciones: sesionesDeApi(await pedirJson(API_SESIONES(plan.id, plan.placeId))) };
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
