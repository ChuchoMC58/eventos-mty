import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent, Category } from "@/lib/events/types";
import { fechaZonaAUtc, hoyEnMonterrey } from "@/lib/ingest/fechas";

// Cultura UANL es el programa cultural de la universidad pública del estado:
// Colegio Civil CCU, Sala Fósforo, Capilla Alfonsina, el Teatro Universitario de
// Mederos y el CIIDA. Ciclos de cine, exposiciones, conferencias y conciertos,
// casi todo de entrada libre — el hueco de "lo gratuito universitario" que ni
// CONARTE (cultura del estado) ni las boleteras cubren.
//
// Es la fuente más limpia del proyecto y por una razón concreta: su WordPress
// usa el plugin **The Events Calendar**, que expone una REST API propia,
// documentada y versionada (`/wp-json/tribe/events/v1/`). No es la REST API
// estándar de WordPress —ésa es la que NO sirve, comprobado en CONARTE y en
// MARCO: `acf` vacío y `date` = fecha de publicación—, sino otra distinta, con
// sede, hora, costo, categoría e imagen de verdad. `robots.txt` sólo prohíbe
// `/wp-admin/`.
//
// ⚠️ NO confundir con `uanl.mx/eventos`, que es la agenda institucional de la
// universidad (cursos de agronomía, capacitaciones en línea, torneos internos).
// Se sondeó el 2026-08-13 y se descartó: 46 eventos de los que 24 no traen ni
// hora, y repite los culturales con OTRO nombre de sede — ingerir las dos
// duplicaría media programación sin que el dedupe pudiera verlo. Ver FUENTES.md.
const API = "https://cultura.uanl.mx/wp-json/tribe/events/v1/events";
const UA = "eventos-mty/1.0 (+https://github.com/ChuchoMC58/eventos-mty)";
const TZ = "America/Monterrey";
const POR_PAGINA = 50;
const MAX_PAGINAS = 5; // hoy son 15 eventos en una página; el tope es por si acaso

/**
 * Las sedes que otra fuente ya trae con otro nombre. Por nombre **exacto**, como
 * en AREMA: con "parecido" se fusionarían recintos distintos que comparten
 * palabras (esta fuente tiene tres sedes que empiezan con "Colegio Civil").
 *
 * Los dos destinos son los nombres que AREMA ya metió en la BD; alinearse con
 * ellos es lo que hace que el dedupe (sede + día + título) pueda fusionar un
 * evento que aparezca en las dos.
 */
const ALIAS_VENUE: Record<string, string> = {
  "Aula Magna Fray Servando Teresa de Mier del Colegio Civil CCU": "Aula Magna Colegio Civil",
  "Teatro Universitario, Unidad Mederos": "Teatro Universitario UANL",
};

/**
 * El mapeo vive aquí, no en el modelo (regla 3). Son las 11 categorías del
 * plugin al 2026-08-13: Academia, Cine, Concierto, Conferencia, Danza, Especial,
 * Exposición, Literatura, Música, Performance y Teatro.
 *
 * Sólo dos van a `musica`; el resto es `cultura` por la regla de "a qué va la
 * gente" —salir, ver algo—. `Academia` es la que se antoja `tecnologia` y no lo
 * es: son coloquios y conferencias de facultad, no meetups de industria, que es
 * lo que esa categoría significa en este proyecto.
 */
const CATEGORIAS: Record<string, Category> = {
  musica: "musica",
  concierto: "musica",
  academia: "cultura",
  cine: "cultura",
  conferencia: "cultura",
  danza: "cultura",
  especial: "cultura",
  exposicion: "cultura",
  literatura: "cultura",
  performance: "cultura",
  teatro: "cultura",
};

export interface TribeVenue {
  venue?: string;
  address?: string;
  city?: string;
  country?: string;
  province?: string;
  stateprovince?: string;
  zip?: string;
}

export interface TribeEvento {
  id?: number;
  url?: string;
  title?: string;
  description?: string;
  image?: { url?: string } | false;
  all_day?: boolean;
  start_date?: string;
  end_date?: string;
  utc_start_date?: string;
  status?: string;
  cost?: string;
  categories?: { name?: string; slug?: string }[];
  venue?: TribeVenue | unknown[];
}

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

/**
 * 🔴 El catálogo de sedes NO es sólo de Monterrey: tiene la Capilla Alfonsina
 * del INBAL (Ciudad de México) y hasta la Casa da América Latina (Lisboa), de
 * colaboraciones y giras. Una agenda universitaria publica lo suyo esté donde
 * esté, así que el filtro geográfico no es opcional.
 *
 * Y no basta con `province === "Nuevo León"`: el Teatro de la Ciudad lo escribe
 * **"N.L."** y la Preparatoria 2 **no trae provincia**, sólo el CP en la calle.
 * Un filtro estricto tiraría dos sedes buenas; por eso hay tres pasos, del dato
 * más fiable al menos.
 */
export function esDeNuevoLeon(v: TribeVenue): boolean {
  const provincia = (v.province || v.stateprovince || "").trim();
  if (provincia) return /nuevo\s*le[oó]n|^n\.?\s*l\.?$/i.test(provincia);
  // Sin provincia: el país descarta lo de fuera y el CP decide el estado. Los de
  // Nuevo León van de 64000 a 67999, así que un domicilio de la Condesa (06xxx)
  // no cuela.
  if (!/m[eé]xico/i.test(v.country || "")) return false;
  return /\b6[4-7]\d{3}\b/.test(`${v.zip ?? ""} ${v.address ?? ""}`);
}

/**
 * "Entrada libre" es `0`, un dato real; vacío es `undefined`, que es "no sé"
 * (regla 4). El plugin guarda el costo como texto libre, así que también hay
 * números sueltos ("$120").
 */
export function parsePrecio(cost?: string): { min?: number; max?: number } {
  const t = texto(cost);
  if (!t) return {};
  if (/gratuit|gratis|entrada libre|sin costo|libre/i.test(t)) return { min: 0 };
  const nums = [...t.matchAll(/([\d,]+(?:\.\d+)?)/g)]
    .map((m) => Number(m[1].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return {};
  if (nums.length === 1) return { min: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/**
 * El plugin deja `cost` vacío en la mayoría y anuncia la entrada libre **dentro
 * del texto** ("Jueves, 19:00 horas. Entrada libre."). Al 2026-08-14 eran 6 de
 * los 7 eventos suyos sin precio, y siendo casi todo el programa gratuito, "no
 * sé" en vez de "Gratis" le quita a esta fuente justo lo que la hace valer.
 *
 * A diferencia de `parsePrecio`, aquí NO se buscan cifras: una descripción es
 * prosa larga llena de números que no son precios ("2023, 127 min", "19:00
 * horas", "1955"). Sólo se reconoce la frase, y sólo si el texto no menciona
 * ningún monto — si habla de dinero, no es asunto de esta función decidir cuál.
 */
export function entradaLibreEnTexto(description?: string): boolean {
  const t = texto(description);
  // `libre` a secas sí vale en el campo `cost`, pero en prosa es "aire libre" y
  // "verso libre": aquí la frase tiene que estar completa.
  if (!/entrada\s+(libre|gratuita)|acceso\s+libre|admisi[oó]n\s+libre|sin\s+costo|gratis|gratuito/i.test(t)) {
    return false;
  }
  return !/\$\s*\d/.test(t);
}

/** Un evento puede traer varias categorías; `musica` gana para no depender del orden. */
export function categoriaDe(cats: { name?: string; slug?: string }[] = []): Category {
  let elegida: Category = "cultura";
  for (const c of cats) {
    const clave = (c.slug || c.name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    const cat = CATEGORIAS[clave];
    if (cat === "musica") return "musica";
    if (cat) elegida = cat;
  }
  return elegida;
}

export function mapEvento(e: TribeEvento, ahora: Date): NormalizedEvent | null {
  const title = texto(e.title);
  const sede = Array.isArray(e.venue) ? undefined : e.venue;
  const nombreSede = texto(sede?.venue);
  if (!title || !nombreSede || !e.start_date) return null;
  if (e.status && e.status !== "publish") return null;
  if (!esDeNuevoLeon(sede!)) return null;

  // Las fechas vienen en hora local del sitio *sin offset* (`2026-08-12
  // 12:00:00`). El plugin también manda `utc_start_date` ya calculado, pero se
  // prefiere interpretar la hora de pared en la zona de Monterrey: es la hora
  // que el sitio le enseña al público, y el `utc_` depende de que la zona
  // configurada en WordPress sea la correcta (hoy dice `America/Mexico_City`,
  // que coincide en offset con Monterrey, pero es la configuración de otro).
  const startsAt = fechaZonaAUtc(e.start_date, TZ);
  if (!startsAt || startsAt <= ahora) return null;

  const fin = e.end_date ? fechaZonaAUtc(e.end_date, TZ) : null;
  // Un taller de varias semanas se publica como UN evento cuyo fin es el de la
  // última sesión ("Círculo de lectura", 19-ago → 23-sep). Mejor sin hora de fin
  // que con una falsa en el calendario y en el ICS. Mismo caso que en Luma.
  const duracionOk = fin && fin > startsAt && fin.getTime() - startsAt.getTime() <= 24 * 3600_000;

  // `cost` manda; si viene vacío, la entrada libre suele estar dicha en el texto.
  const precio = parsePrecio(e.cost);
  if (precio.min === undefined && entradaLibreEnTexto(e.description)) precio.min = 0;
  const ciudad = texto(sede?.city).replace(/,\s*N\.?\s*L\.?$/i, "");

  return {
    title,
    description: texto(e.description).slice(0, 500) || undefined,
    startsAt,
    endsAt: duracionOk ? fin! : undefined,
    category: categoriaDe(e.categories),
    tags: [],
    priceMin: precio.min,
    priceMax: precio.max,
    ticketUrl: e.url,
    imageUrl: e.image && typeof e.image === "object" ? e.image.url : undefined,
    status: "activo",
    venue: {
      name: ALIAS_VENUE[nombreSede] ?? nombreSede,
      address: texto(sede?.address) || undefined,
      // El área es metropolitana: San Nicolás y Guadalupe son otro municipio,
      // no otra ciudad. El municipio real va en `zone`, como en AREMA.
      zone: ciudad && ciudad !== "Monterrey" ? ciudad : undefined,
    },
    city: "monterrey",
  };
}

export function culturaUanlConnector(fetchFn: typeof fetch = fetch): Connector {
  return {
    slug: "cultura-uanl",
    name: "Cultura UANL",
    // Una agenda universitaria publica poco: 15 eventos futuros el 2026-08-13.
    // Con el default de 5, una caída a cero desde 6 no alertaría nunca.
    minExpected: 2,
    async fetchEvents() {
      const ahora = new Date();
      const porUrl = new Map<string, NormalizedEvent>();
      let crudos = 0;
      let fuera = 0;

      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        // `start_date` explícito: la API ya devuelve sólo lo futuro por defecto,
        // pero eso es un default suyo, no un contrato nuestro.
        //
        // El día se pide **en Monterrey**, no en UTC: a las 20:00 de aquí ya es
        // el día siguiente en UTC, y `toISOString()` se habría comido los
        // eventos de esa misma noche. El cron corre a las 06:00, así que el bug
        // no se habría visto nunca en producción.
        const hoy = hoyEnMonterrey(ahora);
        const desde = `${hoy.year}-${String(hoy.month).padStart(2, "0")}-${String(hoy.day).padStart(2, "0")}`;
        const url = `${API}?per_page=${POR_PAGINA}&page=${pagina}&start_date=${desde}`;
        const res = await fetchFn(url, { headers: { "User-Agent": UA } });
        // Pedir una página de más devuelve 404 con `rest_no_results`: así se
        // sabe que se acabaron, sin adivinar por el conteo.
        if (res.status === 404 && pagina > 1) break;
        if (!res.ok) throw new Error(`Cultura UANL: HTTP ${res.status} en la página ${pagina}`);

        const cuerpo = (await res.json()) as { events?: TribeEvento[] };
        const eventos = cuerpo.events;
        if (!Array.isArray(eventos)) {
          throw new Error("Cultura UANL: la respuesta no trae `events` (¿cambió la API del plugin?)");
        }
        if (eventos.length === 0) break;
        crudos += eventos.length;

        for (const e of eventos) {
          const sede = Array.isArray(e.venue) ? undefined : e.venue;
          if (sede?.venue && !esDeNuevoLeon(sede)) fuera++;
          const mapeado = mapEvento(e, ahora);
          if (mapeado) porUrl.set(e.url ?? String(e.id), mapeado);
        }

        if (eventos.length < POR_PAGINA) break;
      }

      // Regla 1: "hoy no hay nada" y "ya no sé leer esto" tienen que distinguirse.
      // La API respondiendo 200 con eventos y nosotros sacando cero es lo segundo
      // —un nombre de campo que cambió—, y `hayCaida()` no lo vería si la corrida
      // anterior también fue baja.
      if (crudos > 0 && porUrl.size === 0) {
        throw new Error(
          `Cultura UANL: la API devolvió ${crudos} eventos y no se pudo mapear ninguno`,
        );
      }
      if (fuera > 0) {
        console.warn(`⚠️  Cultura UANL: ${fuera} eventos fuera de Nuevo León, descartados`);
      }

      return [...porUrl.values()];
    },
  };
}
