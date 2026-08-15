import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent } from "@/lib/events/types";
import { fechaZonaAUtc } from "@/lib/ingest/fechas";

// MARCO (Museo de Arte Contemporáneo de Monterrey) es el museo privado grande de
// la ciudad, y no lo cubre nadie más: CONARTE es cultura del estado y Fever no
// vende sus actividades. Aporta conversatorios, talleres y domingos familiares.
//
// ⚠️ Es WordPress y su REST API estándar está expuesta —hay hasta un post type
// `eventos`— pero NO sirve, exactamente igual que la de CONARTE: `acf` viene
// vacío, `content` viene vacío y `date` es la fecha de publicación. Comprobado el
// 2026-08-13. Los datos de verdad sólo están en el HTML del listado.
//
// 🔴 La paginación del listado MIENTE: los enlaces dicen `/eventos/page/2/` y esa
// URL responde **404**. El tema los intercepta con JS y pide una ruta REST propia
// que devuelve el HTML ya renderizado (`page-eventos.js` la delató). Sin ella se
// pierde la segunda página entera —"Pinta tu mascota" el 2026-08-13— sin que nada
// falle: la primera página responde 200 y trae eventos.
const BASE = "https://www.marco.org.mx/eventos/";
const FILTRAR = "https://www.marco.org.mx/wp-json/eventos/v1/filtrar";
const UA = "eventos-mty/1.0 (+https://github.com/ChuchoMC58/eventos-mty)";
const TZ = "America/Monterrey";
const MAX_PAGINAS = 5; // el listado son 2 páginas; el tope es para no barrer de más

const VENUE = "MARCO";
const DIRECCION = "Juan Zuazua y Jardón s/n, Centro, Monterrey";

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function decodeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#039);/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function texto(html?: string): string {
  if (!html) return "";
  return decodeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** "Lunes 10 de agosto 2026" → {y,m,d}. El día lo manda el encabezado del grupo. */
export function parseDiaEncabezado(s: string): { y: number; m: number; d: number } | null {
  const m = texto(s)
    .toLowerCase()
    .match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/);
  if (!m) return null;
  const mes = MESES[m[2]];
  if (!mes) return null;
  return { y: Number(m[3]), m: mes, d: Number(m[1]) };
}

/** "Miércoles 10:00 a 13:00 hrs" → {inicio:"10:00", fin:"13:00"} */
export function parseHoras(s: string): { inicio: string; fin?: string } | null {
  const t = texto(s);
  const rango = t.match(/(\d{1,2}):(\d{2})\s*(?:a|-|–)\s*(\d{1,2}):(\d{2})/);
  if (rango) {
    return {
      inicio: `${rango[1].padStart(2, "0")}:${rango[2]}`,
      fin: `${rango[3].padStart(2, "0")}:${rango[4]}`,
    };
  }
  const suelta = t.match(/(\d{1,2}):(\d{2})/);
  if (suelta) return { inicio: `${suelta[1].padStart(2, "0")}:${suelta[2]}` };
  return null;
}

/**
 * "Evento gratuito" → 0, que es un dato real y no lo mismo que "no sé" (regla 4).
 * "$500 MXN" → 500. "$1,400 - 3,000 MXN" → 1400 y 3000.
 */
export function parsePrecio(s: string): { min?: number; max?: number } {
  const t = texto(s);
  if (/gratuit|gratis|entrada libre|sin costo/i.test(t)) return { min: 0 };
  const nums = [...t.matchAll(/\$?\s*([\d,]+(?:\.\d+)?)/g)]
    .map((m) => Number(m[1].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return {};
  if (nums.length === 1) return { min: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export interface Listado {
  eventos: NormalizedEvent[];
  /** El HTML tiene la forma esperada (al menos un encabezado de día). */
  reconocible: boolean;
  /** Entradas descartadas por no traer hora: cursos de varios meses. */
  sinHora: number;
}

export function parseListado(html: string): Listado {
  // El listado agrupa por día: un <h2 class="evento-group-header"> con la fecha
  // y debajo las tarjetas de ese día. La fecha del encabezado es la buena — las
  // tarjetas repiten la suya en formato libre ("Del 10 de agosto al 30 de
  // septiembre") y ésa no siempre es una fecha.
  const trozos = html.split(/<h2[^>]*class="[^"]*evento-group-header[^"]*"[^>]*>/);
  if (trozos.length < 2) return { eventos: [], reconocible: false, sinHora: 0 };

  const eventos: NormalizedEvent[] = [];
  let sinHora = 0;

  for (const trozo of trozos.slice(1)) {
    const cierre = trozo.indexOf("</h2>");
    if (cierre < 0) continue;
    const dia = parseDiaEncabezado(trozo.slice(0, cierre));
    if (!dia) continue;
    const cuerpo = trozo.slice(cierre);

    const tarjetas = cuerpo.matchAll(
      /<a\s[^>]*href="(https:\/\/www\.marco\.org\.mx\/eventos\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/g,
    );
    for (const [, url, dentro] of tarjetas) {
      // Los enlaces de la paginación (`/eventos/page/2/`) caen en el mismo patrón
      // y sólo se distinguen por no traer título.
      if (/\/eventos\/page\/\d+\/?$/.test(url)) continue;
      const title = texto(dentro.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1]);
      if (!title) continue;

      const spans = [...dentro.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((m) => m[1]).join(" | ");
      const horas = parseHoras(spans);
      if (!horas) {
        // Los paquetes de cursos ("Del 10 de agosto al 30 de septiembre") no
        // tienen hora porque no son un evento en un día: son una inscripción
        // abierta. Inventarles una hora los pondría en la cartelera y en el ICS
        // con un dato falso.
        sinHora++;
        continue;
      }

      const ymd = `${dia.y}-${String(dia.m).padStart(2, "0")}-${String(dia.d).padStart(2, "0")}`;
      const startsAt = fechaZonaAUtc(`${ymd} ${horas.inicio}`, TZ);
      if (!startsAt) continue;
      const endsAt = horas.fin ? fechaZonaAUtc(`${ymd} ${horas.fin}`, TZ) : null;

      const precio = parsePrecio(dentro.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "");
      const imagen = dentro.match(/<img[^>]*src="([^"]+)"/)?.[1];

      eventos.push({
        title,
        startsAt,
        endsAt: endsAt && endsAt > startsAt ? endsAt : undefined,
        // Museo de arte: conversatorios, talleres y actividades familiares. Todo
        // cae en `cultura` por la regla de "a qué va la gente" —salir, ver arte—,
        // y los talleres artísticos están nombrados en esa categoría.
        category: "cultura",
        tags: [],
        priceMin: precio.min,
        priceMax: precio.max,
        ticketUrl: url,
        imageUrl: imagen,
        status: "activo",
        venue: { name: VENUE, address: DIRECCION },
        city: "monterrey",
      });
    }
  }

  return { eventos, reconocible: true, sinHora };
}

export function marcoConnector(fetchFn: typeof fetch = fetch): Connector {
  return {
    slug: "marco",
    name: "MARCO",
    // Un museo publica pocas actividades: rondan la decena. Con el default de 5
    // una caída a la mitad no alertaría nunca.
    minExpected: 2,
    async fetchEvents() {
      const porUrl = new Map<string, NormalizedEvent>();
      let paginasReconocibles = 0;
      let sinHora = 0;

      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        // La primera página se pide a la URL canónica y el resto a la ruta REST
        // del tema. Así, si el tema cambia y la ruta desaparece, la fuente pierde
        // la cola pero no se apaga entera.
        const url = pagina === 1 ? BASE : `${FILTRAR}?paged=${pagina}`;
        const res = await fetchFn(url, { headers: { "User-Agent": UA } });
        if (res.status === 404) break; // se acabaron las páginas
        if (!res.ok) {
          if (pagina === 1) throw new Error(`MARCO HTTP ${res.status} en ${url}`);
          console.warn(`⚠️  MARCO: HTTP ${res.status} en la página ${pagina}; se sigue con lo que hay`);
          break;
        }

        const listado = parseListado(await res.text());
        if (!listado.reconocible) break;
        paginasReconocibles++;
        sinHora += listado.sinHora;

        // Una página sin eventos nuevos significa que la paginación dio la vuelta
        // (WordPress sirve la última página para un número de más).
        const antes = porUrl.size;
        for (const e of listado.eventos) if (e.ticketUrl) porUrl.set(e.ticketUrl, e);
        if (porUrl.size === antes) break;
      }

      // Regla 1: distinguir "hoy no hay nada" de "ya no sé leer esto". Si ninguna
      // página tuvo la forma esperada, el tema del sitio cambió; si la tuvieron y
      // aun así no salió un solo evento, el parseo de tarjetas es lo que se rompió.
      if (paginasReconocibles === 0) {
        throw new Error("MARCO: ninguna página trajo encabezados de día (¿cambió el tema?)");
      }
      if (porUrl.size === 0) {
        throw new Error(
          `MARCO: ${paginasReconocibles} páginas con la forma esperada y cero eventos parseados`,
        );
      }
      if (sinHora > 0) {
        console.warn(`⚠️  MARCO: ${sinHora} entradas sin hora (cursos de temporada), descartadas`);
      }

      // El listado deja el evento del día en curso aunque ya haya pasado su hora
      // (el conversatorio del 12 seguía ahí el 13). El filtro va aquí y no en
      // parseListado para que el parseo se pueda probar con un fixture sin que la
      // fecha del reloj lo vacíe.
      const ahora = new Date();
      return [...porUrl.values()].filter((e) => e.startsAt > ahora);
    },
  };
}
