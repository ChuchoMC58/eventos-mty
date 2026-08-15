import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent, Category } from "@/lib/events/types";
import { fechaZonaAUtc, hoyEnMonterrey } from "@/lib/ingest/fechas";

/**
 * Superboletos — la boletera que surte a Showcenter Complex, Dion Live Center y
 * varios venues chicos que ninguna otra fuente nuestra ve. También vende Arena
 * Monterrey, que ya cubren Ticketmaster y el conector de la Arena.
 *
 * No se scrapea: su front (Next.js) lee un único JSON en CloudFront con el
 * catálogo nacional completo. Son 3 peticiones fijas — home → chunk → JSON — y
 * cero por evento. Ver FUENTES.md para el reconocimiento completo.
 */
const HOME = "https://www.superboletos.com";
const CDN = "https://dl09mj2qf37fz.cloudfront.net/SuperBoletosRepositorio/apps/jsonCache";
const UA = "eventos-mty/1.0 (+https://github.com/ChuchoMC58/eventos-mty)";
const TZ = "America/Monterrey";

/**
 * El JSON es un HISTÓRICO, no una cartelera: trae eventos desde 2013. Sin este
 * corte se ingiere una década de basura.
 */
const GRACIA_PASADO_MS = 12 * 3600_000; // un evento de hoy que ya empezó sigue valiendo

/**
 * Sin año explícito el catálogo se refiere al año en curso. En diciembre eso
 * leería un anuncio de enero como enero *pasado*, así que una fecha que cae
 * demasiado atrás se reinterpreta como del año siguiente.
 */
const GRACIA_ANIO_MS = 60 * 86_400_000;

/**
 * Piso de eventos vigentes cuando el catálogo nacional viene sano. `hayCaida()`
 * sólo ve la caída a CERO; un colapso parcial —84 → 3 porque cambió el nombre de
 * un campo y el filtro se come casi todo— le es invisible. Eso lo tiene que
 * detectar el conector (regla 1 de FUENTES.md).
 */
const MIN_VIGENTES = 20;
const CATALOGO_SANO = 100;

interface SbEvent {
  eventoId?: string;
  nombreEvento?: string;
  nombreRecinto?: string;
  nombreCiudad?: string;
  abrevEstado?: string;
  claveTipoEvento?: string;
  claveGenero?: string;
  claveEstatusFechaEvento?: string;
  fechas?: string;
  precioMinimo?: string;
  precioMaximo?: string;
  rutaImagenMain?: string;
  rutaImagenThumb?: string;
}

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/**
 * Sólo la forma canónica `DD de MES [de YYYY] HH:MM`. Los rangos
 * ("Del Jue. 21 al Dom. 24 Mayo") se descartan a propósito: son ~13 de 97 y al
 * no traer año son ambiguos — THE BOOK OF MORMON, "Del Jue. 21 al Dom. 24
 * Mayo", era de mayo de 2026 y ya había pasado. Mejor perderlos que publicar
 * como futuro algo que ya ocurrió.
 */
const RX_FECHA = /^(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+)(?:\s+de\s+(\d{4}))?\s+(\d{1,2}):(\d{2})/i;

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "06 de Noviembre 21:00 Hrs." → Date en UTC. Las fechas son *timezone-naive* en
 * hora de Monterrey, la misma trampa de CONARTE: parsearlas directo funciona en
 * prod (que corre en America/Monterrey) y falla en local, el peor modo de fallar.
 */
export function parseFechaSb(fechas: string | undefined, ahora: Date = new Date()): Date | null {
  const m = (fechas ?? "").trim().match(RX_FECHA);
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = MESES[sinAcentos(m[2])];
  const hora = Number(m[4]);
  const min = Number(m[5]);
  if (!mes || hora > 23 || min > 59) return null;

  const armar = (anio: number): Date | null => {
    // Date.UTC hace rollover silencioso: el 31 de febrero se vuelve 3 de marzo.
    const prueba = new Date(Date.UTC(anio, mes - 1, dia));
    if (prueba.getUTCDate() !== dia || prueba.getUTCMonth() !== mes - 1) return null;
    return fechaZonaAUtc(`${anio}-${pad(mes)}-${pad(dia)} ${pad(hora)}:${pad(min)}`, TZ);
  };

  const anioExplicito = m[3] ? Number(m[3]) : null;
  const fecha = armar(anioExplicito ?? hoyEnMonterrey(ahora).year);
  if (!fecha || anioExplicito) return fecha;

  return fecha.getTime() < ahora.getTime() - GRACIA_ANIO_MS
    ? armar(hoyEnMonterrey(ahora).year + 1) ?? fecha
    : fecha;
}

/**
 * `claveTipoEvento` NO sirve como señal principal: "Familiares" es un cajón de
 * marketing donde caen Melanie Martinez, Morat y Elefante — los 12 vienen con
 * `claveGenero: MUSICAL` y son conciertos. El género es la señal limpia.
 */
const GENERO_CULTURA = new Set([
  "TEATRO",
  "TEATRO_MUSICAL",
  "EXPOSICION",
  "MOTIVACION",
  "EMPRESAS_PRIVADA",
  "DANZA",
  "COMEDIA",
  "STAND_UP",
]);
const GENERO_DEPORTES = new Set([
  "ARTES_MARCIALES",
  "LUCHA_LIBRE",
  "LNBP",
  "RODEO",
  "CORRIDAS_TOROS",
  "BOX",
  "FUTBOL",
  "BEISBOL",
]);
// Sólo como respaldo cuando el género no dice nada. "Familiares" queda fuera a
// propósito: mapearlo mandaría conciertos a la categoría equivocada.
const TIPO: Record<string, Category> = {
  Conciertos: "musica",
  "Teatro y musicales": "cultura",
  Deportes: "deportes",
  "Expos y conferencia": "cultura",
};

export function categoryFrom(e: SbEvent): Category {
  const genero = (e.claveGenero ?? "").toUpperCase();
  if (GENERO_DEPORTES.has(genero)) return "deportes";
  if (GENERO_CULTURA.has(genero)) return "cultura";
  return TIPO[e.claveTipoEvento ?? ""] ?? "musica";
}

/**
 * Aquí `0` significa "no sé", al revés que en CONARTE, donde un 0 es entrada
 * libre real. Los 84 vigentes traen `precioMinimo` y `precioMaximo` en "0": si
 * se copiaran tal cual, toda la cartelera diría "Gratis". Se lee por si algún
 * día lo publican, pero el 0 nunca pasa.
 */
function precio(v?: string): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function mapSbEvent(e: SbEvent, ahora: Date = new Date()): NormalizedEvent | null {
  const title = (e.nombreEvento ?? "").trim();
  const venueName = (e.nombreRecinto ?? "").trim();
  if (!title || !venueName || !e.eventoId) return null;

  const startsAt = parseFechaSb(e.fechas, ahora);
  if (!startsAt) return null;
  if (startsAt.getTime() < ahora.getTime() - GRACIA_PASADO_MS) return null;

  const ciudad = (e.nombreCiudad ?? "").trim();
  return {
    title,
    startsAt,
    category: categoryFrom(e),
    tags: [],
    priceMin: precio(e.precioMinimo),
    priceMax: precio(e.precioMaximo),
    ticketUrl: `${HOME}/landing-evento/${e.eventoId}`,
    imageUrl: e.rutaImagenMain || e.rutaImagenThumb || undefined,
    status: "activo",
    // El nombre debe coincidir EXACTO con el de Ticketmaster y el conector de la
    // Arena ("Arena Monterrey") o el dedupe no fusiona y se duplican ~49 eventos
    // entre tres fuentes.
    venue: { name: venueName, zone: ciudad && ciudad !== "Monterrey" ? ciudad : undefined },
    city: "monterrey", // el área es metropolitana; el municipio real va en zone
  };
}

/**
 * La URL del catálogo lleva el número de build del sitio, que cambia. Las
 * versiones viejas responden 403 —lo probé con 27767, 27700, 27000 y 26000—, así
 * que fijarla rompería ruidosamente en vez de servir un catálogo congelado; aun
 * así conviene resolverla en cada corrida.
 */
export async function resolverVersion(pedir: (url: string) => Promise<Response>): Promise<string> {
  const home = await pedir(`${HOME}/`);
  if (!home.ok) throw new Error(`Superboletos home HTTP ${home.status}`);
  const chunk = (await home.text()).match(/\/_next\/static\/chunks\/pages\/_app-[a-f0-9]+\.js/)?.[0];
  if (!chunk) throw new Error("Superboletos: la home ya no referencia el chunk _app (¿cambió el build?)");

  const js = await pedir(`${HOME}${chunk}`);
  if (!js.ok) throw new Error(`Superboletos chunk HTTP ${js.status}`);
  const version = (await js.text()).match(/NEXT_PUBLIC_CDN_CONTENT_VERSION:"(\d+)"/)?.[1];
  if (!version) throw new Error("Superboletos: el chunk ya no declara CDN_CONTENT_VERSION");
  return version;
}

export function superboletosConnector(fetchFn: typeof fetch = fetch, ahora?: () => Date): Connector {
  const now = ahora ?? (() => new Date());
  return {
    slug: "superboletos",
    name: "Superboletos",
    async fetchEvents() {
      const pedir = (url: string) => fetchFn(url, { headers: { "user-agent": UA } });
      const version = await resolverVersion(pedir);

      const res = await pedir(`${CDN}/${version}/catalogos/search.json`);
      if (!res.ok) throw new Error(`Superboletos search.json HTTP ${res.status} (versión ${version})`);
      const catalogo = (await res.json()) as SbEvent[];
      if (!Array.isArray(catalogo) || catalogo.length === 0) {
        throw new Error("Superboletos: el catálogo vino vacío o no es un arreglo");
      }

      const enNL = catalogo.filter((e) => e.abrevEstado === "NL");
      // Casi la mitad del histórico de NL está CANCELADO. Se descartan en vez de
      // emitirlos con status "cancelado" porque `upsertEvents` SÍ actualiza
      // `status`, y 49 de estos eventos también los traen Ticketmaster y la
      // Arena: el estado haría ping-pong según qué conector corriera al final.
      const activos = enNL.filter((e) => e.claveEstatusFechaEvento === "NORMAL");
      const eventos = activos.map((e) => mapSbEvent(e, now())).filter((e): e is NormalizedEvent => e !== null);

      if (catalogo.length >= CATALOGO_SANO && eventos.length < MIN_VIGENTES) {
        throw new Error(
          `Superboletos: catálogo sano (${catalogo.length}) pero sólo ${eventos.length} vigentes en NL ` +
            `(${enNL.length} en NL, ${activos.length} no cancelados) — ¿cambió el esquema?`,
        );
      }

      const descartados = activos.length - eventos.length;
      if (descartados > 0) {
        console.warn(
          `[superboletos] ${descartados} de ${activos.length} descartados por fecha ` +
            `(rango, formato raro o ya pasada); ${eventos.length} vigentes`,
        );
      }
      return eventos;
    },
  };
}
