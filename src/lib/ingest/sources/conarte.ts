import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent, Category } from "@/lib/events/types";
import { fechaZonaAUtc } from "@/lib/ingest/fechas";

// CONARTE (Consejo para la Cultura y las Artes de NL) publica su agenda en
// WordPress. La REST API existe pero NO sirve: `date` es la fecha de publicación
// y `acf` viene vacío, así que no hay fecha de evento ni sede ni costo. Los datos
// sólo están en el HTML, en dos etapas: barrido por día → página de detalle.
// El detalle trae el widget addtocalendar con fechas legibles por máquina, que es
// lo que hace viable el conector. Ver FUENTES.md.
const BASE = "https://conarte.org.mx/agenda/"; // la diagonal final es obligatoria: sin ella es 301 con cuerpo vacío
const UA = "eventos-mty/1.0 (+https://github.com/ChuchoMC58/eventos-mty)";
const DIAS_BARRIDO = 21; // cubre de sobra el horizonte de 10 días del digest
const DETALLES_EN_PARALELO = 4; // sitio de gobierno sin rate limit declarado: no lo apuremos

// Casi todas las disciplinas de CONARTE (Literatura, Danza, Teatro, Cine, Artes
// Plásticas…) colapsan a "cultura"; la disciplina original se conserva en tags
// para no perder granularidad en el matching del digest.
const DISCIPLINA_MUSICAL = /m[úu]sica|[óo]pera|coro|jazz|concierto/i;

const SEDE_DESCONOCIDA = "CONARTE (sede por confirmar)";

function decodeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#039);/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // al final: "&amp;lt;" debe quedar en "&lt;", no en "<"
}

function texto(html?: string): string {
  if (!html) return "";
  return decodeHtml(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

// Igual que texto(), pero conserva los saltos de <br> (las descripciones traen
// varias líneas: quién imparte, horarios, informes).
function textoConSaltos(html?: string): string {
  if (!html) return "";
  return decodeHtml(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// El manejo de fechas naive se movió a `@/lib/ingest/fechas` cuando Superboletos
// necesitó lo mismo. Se re-exporta porque los tests de CONARTE lo importan desde
// aquí y el caso que cubren —el mismo evento bajo tres TZ— sigue siendo suyo.
export { fechaZonaAUtc };

// "YYYYMMDD" del día en Monterrey, no en la TZ del proceso.
export function paramFecha(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/-/g, "");
}

export interface Listado {
  urls: string[];
  /** El HTML tiene la forma que esperamos (resultados o el aviso de día vacío). */
  entendido: boolean;
}

/**
 * Etapa 1: de la página de un día saca las URLs de detalle.
 *
 * Un día sin eventos igual renderiza un `<li>`, con `no-events` adentro; contarlo
 * como evento produce registros fantasma con todos los campos en null.
 */
export function parseListado(html: string): Listado {
  const area = html.match(/<div id="result_area"[\s\S]*?<\/ul>/i)?.[0];
  if (!area) return { urls: [], entendido: false };
  let vacio = false;
  const urls: string[] = [];
  for (const [, li] of area.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    if (/no-events/i.test(li)) {
      vacio = true;
      continue;
    }
    const href = li.match(/href="(https:\/\/conarte\.org\.mx\/agenda\/[^"?#]+)"/i)?.[1];
    if (href) urls.push(href);
  }
  return { urls, entendido: vacio || urls.length > 0 };
}

export function parseCosto(html?: string): { priceMin?: number; priceMax?: number } {
  const t = texto(html);
  if (!t) return {};
  if (/entrada libre|gratis|gratuito|sin costo|acceso libre/i.test(t)) return { priceMin: 0 };
  // "$2550 – Módulo", "$150 general / $100 estudiantes"
  const montos = [...t.matchAll(/\$\s?([\d][\d.,]*)/g)]
    .map((m) => Number(m[1].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
  if (montos.length === 0) return {}; // no parsea: "no sé el precio", que no es lo mismo que gratis
  const min = Math.min(...montos);
  const max = Math.max(...montos);
  return { priceMin: min, priceMax: max === min ? undefined : max };
}

/**
 * Etapa 2: la página de detalle. Un evento recurrente emite un bloque
 * `atc_event` por ocurrencia, y cada uno se expande a un NormalizedEvent.
 */
export function parseDetalle(html: string, url: string): NormalizedEvent[] {
  const title = texto(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  if (!title) return [];

  const etiqueta = texto(html.match(/<p\s+class="label">([\s\S]*?)<\/p>/i)?.[1]);
  // `agenda • Disciplina`, y a veces `agenda • Disciplina • Ciclo`. La
  // disciplina es SIEMPRE la segunda, nunca la última: con `.pop()`, un evento
  // que pertenece a un ciclo se leía con el nombre del ciclo, y como de ahí sale
  // `DISCIPLINA_MUSICAL`, un concierto dentro de un festival caía en `cultura`.
  const disciplina = etiqueta.split("•")[1]?.trim() ?? "";

  // La sede confiable es el subtitle del detalle; el kicker del listado a veces
  // trae un pedazo de la descripción. El separador " I " es jerarquía
  // ("Museo … I Librería"): nos quedamos con el recinto para no crear un Venue
  // por cada sala.
  const subtitulo = texto(html.match(/<p\s+class="subtitle">([\s\S]*?)<\/p>/i)?.[1]);
  const sede = subtitulo.split(/\s+I\s+/)[0].trim() || SEDE_DESCONOCIDA;

  const descripcion = textoConSaltos(
    html.match(/<div\s+class="excerpt">([\s\S]*?)<\/div>/i)?.[1],
  );
  const imageUrl = html.match(/bg_featured_banner"[^>]*background-image:\s*url\(([^)]+)\)/i)?.[1];
  const { priceMin, priceMax } = parseCosto(
    html.match(/<dt[^>]*>\s*Costo\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i)?.[1],
  );

  const category: Category = DISCIPLINA_MUSICAL.test(disciplina) ? "musica" : "cultura";

  const eventos: NormalizedEvent[] = [];
  for (const bloque of html.split(/<var\s+class="atc_date_start">/i).slice(1)) {
    const inicio = bloque.match(/^([^<]+)/)?.[1];
    if (!inicio) continue;
    const tz = bloque.match(/<var\s+class="atc_timezone">([^<]+)/i)?.[1]?.trim() || "America/Monterrey";
    const startsAt = fechaZonaAUtc(inicio, tz);
    if (!startsAt) continue;
    const fin = bloque.match(/<var\s+class="atc_date_end">([^<]+)/i)?.[1];
    const endsAt = fin ? fechaZonaAUtc(fin, tz) : null;
    eventos.push({
      title,
      description: descripcion || undefined,
      startsAt,
      endsAt: endsAt && endsAt > startsAt ? endsAt : undefined,
      category,
      tags: disciplina ? [disciplina.toLowerCase()] : [],
      priceMin,
      priceMax,
      ticketUrl: url, // no vende boletos, pero es el enlace canónico del evento
      imageUrl: imageUrl?.replace(/^["']|["']$/g, ""),
      status: "activo", // el sitio no expone cancelaciones
      venue: { name: sede },
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

export function conarteConnector(fetchFn: typeof fetch = fetch, dias = DIAS_BARRIDO): Connector {
  return {
    slug: "conarte",
    name: "CONARTE Nuevo León",
    // La fuente rinde ~5 eventos en 3 semanas: con el umbral global de 5 una
    // caída a cero podría no alertar nunca.
    minExpected: 2,
    async fetchEvents() {
      const pedir = (url: string) => fetchFn(url, { headers: { "user-agent": UA } });

      const hoy = new Date();
      const urls = new Set<string>();
      let entendidos = 0;
      for (let i = 0; i < dias; i++) {
        const dia = new Date(hoy.getTime() + i * 86_400_000);
        const res = await pedir(`${BASE}?fecha=${paramFecha(dia)}`);
        if (!res.ok) throw new Error(`CONARTE listado HTTP ${res.status}`);
        const listado = parseListado(await res.text());
        if (listado.entendido) entendidos++;
        listado.urls.forEach((u) => urls.add(u)); // un recurrente aparece en varios días
      }
      // Distinguir "no hay eventos" de "ya no sé leer la página": si ningún día
      // tuvo la forma esperada, el tema cambió y el conector está ciego. Sin
      // esto el fallo sería silencioso — cero eventos y ningún error.
      if (entendidos === 0) {
        throw new Error(`CONARTE: markup desconocido en los ${dias} días barridos (¿cambió el tema?)`);
      }

      const detalles = await enTandas([...urls], DETALLES_EN_PARALELO, async (url) => {
        const res = await pedir(url);
        if (!res.ok) return null;
        return { url, eventos: parseDetalle(await res.text(), url) };
      });
      if (urls.size > 0 && detalles.every((d) => d === null)) {
        throw new Error("CONARTE: ningún detalle respondió");
      }

      // Una página que responde 200 y de la que no sale ni un evento es un
      // parser ciego, no un día sin cartelera — y hasta el 2026-08-06 ese caso
      // pasaba callado: un salto de línea dentro de `<var class="atc_date_start">`
      // tiraba 3 eventos sin que nada lo dijera.
      const mudas = detalles.filter((d) => d !== null && d.eventos.length === 0);
      const respondieron = detalles.filter((d) => d !== null);
      if (respondieron.length > 0 && mudas.length === respondieron.length) {
        throw new Error(
          `CONARTE: ${mudas.length} detalles respondieron y ninguno soltó eventos (¿cambió el markup?)`,
        );
      }
      if (mudas.length > 0) {
        console.warn(
          `⚠️  CONARTE: ${mudas.length}/${respondieron.length} detalles sin eventos legibles: ` +
            mudas.map((d) => d!.url).join(", "),
        );
      }

      const desde = Date.now() - 12 * 3_600_000; // un recurrente lista también sus fechas pasadas
      return detalles
        .flatMap((d) => d?.eventos ?? [])
        .filter((e) => e.startsAt.getTime() >= desde);
    },
  };
}
