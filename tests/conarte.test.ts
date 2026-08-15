import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  conarteConnector,
  fechaZonaAUtc,
  paramFecha,
  parseCosto,
  parseDetalle,
  parseListado,
} from "@/lib/ingest/sources/conarte";

const fixture = (n: string) => readFileSync(path.join(__dirname, "fixtures", n), "utf8");
const dia = fixture("conarte-dia.html");
const vacio = fixture("conarte-vacio.html");
const charla = fixture("conarte-detalle-charla.html");
const diplomado = fixture("conarte-detalle-diplomado.html");
const concierto = fixture("conarte-detalle-concierto.html");
// Página real del 2026-08-06: el HTML del sitio parte las etiquetas en dos
// líneas (`<var\nclass="atc_date_start">`) según dónde caiga el ancho.
const envuelto = fixture("conarte-detalle-envuelto.html");

const URL_CHARLA = "https://conarte.org.mx/agenda/charla-i-la-orogenia-y-la-representacion-del-paisaje-nuevoleones/";
const URL_DIPLOMADO = "https://conarte.org.mx/agenda/diplomado-i-modulo-iii-danzando-la-cotidianidad/";

// Enruta por URL: los listados por ?fecha= y los detalles por su slug.
function fakeFetch(porDia: Record<string, string>, detalles: Record<string, string> = {}) {
  const llamadas: string[] = [];
  const fn = (async (url: string) => {
    llamadas.push(url);
    const fecha = url.match(/\?fecha=(\d{8})/)?.[1];
    if (fecha) return new Response(porDia[fecha] ?? vacio);
    const cuerpo = detalles[url];
    return cuerpo ? new Response(cuerpo) : new Response("no encontrado", { status: 404 });
  }) as unknown as typeof fetch;
  return { fn, llamadas };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("parseListado", () => {
  it("saca las URLs de detalle del día", () => {
    const { urls, entendido } = parseListado(dia);
    expect(entendido).toBe(true);
    expect(urls).toEqual([URL_CHARLA, URL_DIPLOMADO]);
  });

  it("un día vacío se entiende pero no produce eventos (el <li> señuelo)", () => {
    expect(parseListado(vacio)).toEqual({ urls: [], entendido: true });
  });

  it("marca como no entendido un HTML sin result_area", () => {
    expect(parseListado("<html><body><p>otra plantilla</p></body></html>").entendido).toBe(false);
  });
});

describe("fechas timezone-naive", () => {
  // El sitio publica "2026-08-06 18:30:00" sin offset. Prod corre en
  // America/Monterrey y el host y los tests en UTC: parsear con la TZ del
  // proceso da resultados distintos según dónde corra.
  it("interpreta la hora en la zona del evento, no en la del proceso", () => {
    const original = process.env.TZ;
    try {
      const esperado = "2026-08-07T00:30:00.000Z";
      for (const tz of ["UTC", "America/Monterrey", "Asia/Tokyo"]) {
        process.env.TZ = tz;
        expect(fechaZonaAUtc("2026-08-06 18:30:00", "America/Mexico_City")?.toISOString()).toBe(esperado);
      }
    } finally {
      process.env.TZ = original;
    }
  });

  it("cae a UTC−6 si la zona es desconocida", () => {
    expect(fechaZonaAUtc("2026-08-06 18:30:00", "Marte/Olympus")?.toISOString()).toBe(
      "2026-08-07T00:30:00.000Z",
    );
  });

  it("descarta una fecha con formato inesperado", () => {
    expect(fechaZonaAUtc("6 de agosto", "America/Monterrey")).toBeNull();
  });

  it("el día del barrido es el de Monterrey, no el del proceso", () => {
    // 06:00 UTC del 7 todavía es 6 de agosto en Monterrey.
    expect(paramFecha(new Date("2026-08-07T05:00:00Z"))).toBe("20260806");
  });
});

describe("parseCosto", () => {
  it("entrada libre es 0, no 'no sé'", () => expect(parseCosto("Entrada libre")).toEqual({ priceMin: 0 }));
  it("un monto suelto", () => expect(parseCosto("$2550 &#8211; M&#243;dulo <br>")).toEqual({ priceMin: 2550 }));
  it("dos montos son rango", () =>
    expect(parseCosto("$150 general / $100 estudiantes")).toEqual({ priceMin: 100, priceMax: 150 }));
  it("miles con coma", () => expect(parseCosto("$1,200 por persona")).toEqual({ priceMin: 1200 }));
  it("sin dato deja undefined, que no es lo mismo que gratis", () =>
    expect(parseCosto("Consultar en taquilla")).toEqual({}));
});

describe("parseDetalle", () => {
  it("mapea la charla completa", () => {
    const [e, ...resto] = parseDetalle(charla, URL_CHARLA);
    expect(resto).toHaveLength(0);
    expect(e.title).toBe("Charla I La orogenia y la representación del paisaje nuevoleonés");
    expect(e.startsAt.toISOString()).toBe("2026-08-07T00:30:00.000Z"); // 18:30 en Monterrey
    expect(e.endsAt?.toISOString()).toBe("2026-08-07T02:30:00.000Z");
    expect(e.category).toBe("cultura");
    expect(e.tags).toEqual(["artes plásticas"]); // la disciplina original, que "cultura" se come
    expect(e.priceMin).toBe(0);
    expect(e.venue.name).toBe("Centro de las Artes");
    expect(e.ticketUrl).toBe(URL_CHARLA);
    expect(e.imageUrl).toMatch(/^https:\/\/conarte\.org\.mx\/.*\.jpg$/);
    expect(e.description).toContain("Antonio Guerrero Aguilar");
  });

  it("lee un detalle con las etiquetas partidas en dos líneas", () => {
    // El sitio envuelve el HTML por ancho, así que `<var class="atc_date_start">`
    // aparece como `<var\nclass=...` en unas páginas y no en otras. Buscar el
    // espacio literal tiraba esos eventos EN SILENCIO: 3 el 2026-08-06.
    expect(envuelto).toContain('<var\nclass="atc_date_start">');
    const [e, ...resto] = parseDetalle(envuelto, "https://conarte.org.mx/agenda/taller-i-cartilago/");
    expect(resto).toHaveLength(0);
    expect(e.title).toBe("Taller I Cartílago: Sostener la acción");
    expect(e.startsAt.toISOString()).toBe("2026-08-06T21:30:00.000Z"); // 15:30 en Monterrey
    expect(e.endsAt?.toISOString()).toBe("2026-08-06T23:30:00.000Z");
    // Los demás campos también salen de patrones con `class=`: si sólo se
    // arreglara la fecha, éstos seguirían vacíos sin que nada truene.
    expect(e.venue.name).toBe("Sala Acristalada. Nave Generadores");
    // La etiqueta es `agenda • Performance • II Encuentro de Artes Visuales`:
    // la disciplina es la segunda, no la última. Con `.pop()` salía el nombre
    // del ciclo — y como de ahí sale la categoría, un concierto dentro de un
    // festival habría caído en `cultura`.
    expect(e.tags).toEqual(["performance"]);
  });

  it("un concierto dentro de un ciclo sigue siendo musica", () => {
    const conCiclo = concierto.replace(
      /(<p class="label">[\s\S]*?)<\/p>/i,
      "$1 • XII Festival de Música Antigua</p>",
    );
    const [e] = parseDetalle(conCiclo, "https://conarte.org.mx/agenda/recital/");
    expect(e.category).toBe("musica");
    expect(e.tags).toEqual(["música"]);
  });

  it("expande un recurrente a una ocurrencia por bloque y usa sede provisional si no hay subtitle", () => {
    const eventos = parseDetalle(diplomado, URL_DIPLOMADO);
    expect(eventos.map((e) => e.startsAt.toISOString())).toEqual([
      "2026-08-08T16:00:00.000Z",
      "2026-08-15T16:00:00.000Z",
    ]);
    expect(eventos[0].venue.name).toBe("CONARTE (sede por confirmar)");
    expect(eventos[0].priceMin).toBe(2550);
    expect(eventos[0].category).toBe("cultura");
  });

  it("una disciplina musical va a musica y la sede se corta en el separador ' I '", () => {
    const [e] = parseDetalle(concierto, "https://conarte.org.mx/agenda/recital/");
    expect(e.category).toBe("musica");
    expect(e.venue.name).toBe("Museo Estatal de Culturas Populares");
    expect(e.priceMin).toBe(100);
    expect(e.priceMax).toBe(150);
  });

  it("ignora una página sin título", () => {
    expect(parseDetalle("<html><body>error</body></html>", "https://conarte.org.mx/x/")).toEqual([]);
  });
});

describe("conarteConnector", () => {
  it("barre los días, deduplica los recurrentes y trae los eventos", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-05T12:00:00Z"));
    // El mismo par de eventos aparece en dos días distintos del barrido: sin
    // dedupe de URLs el detalle se pediría (y se ingeriría) dos veces.
    const { fn, llamadas } = fakeFetch(
      { "20260806": dia, "20260807": dia },
      { [URL_CHARLA]: charla, [URL_DIPLOMADO]: diplomado },
    );
    const eventos = await conarteConnector(fn, 3).fetchEvents();

    expect(llamadas.filter((u) => u.includes("?fecha=")).length).toBe(3);
    expect(llamadas.filter((u) => u === URL_CHARLA).length).toBe(1);
    expect(eventos).toHaveLength(3); // charla + las dos fechas del diplomado
    expect(llamadas[0]).toBe("https://conarte.org.mx/agenda/?fecha=20260805"); // con diagonal: sin ella es 301 vacío
  });

  it("descarta ocurrencias ya pasadas de un recurrente", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-12T12:00:00Z")); // entre las dos fechas del diplomado
    const { fn } = fakeFetch({ "20260812": dia }, { [URL_CHARLA]: charla, [URL_DIPLOMADO]: diplomado });
    const eventos = await conarteConnector(fn, 1).fetchEvents();
    expect(eventos.map((e) => e.startsAt.toISOString())).toEqual(["2026-08-15T16:00:00.000Z"]);
  });

  it("un barrido sin eventos NO es error: la agenda puede estar vacía", async () => {
    const { fn } = fakeFetch({});
    await expect(conarteConnector(fn, 3).fetchEvents()).resolves.toEqual([]);
  });

  it("si ningún día tiene la forma esperada, revienta en vez de reportar cero", async () => {
    // Cambio de tema del sitio: cero eventos y ningún error sería un fallo mudo.
    const otroSitio = (async () =>
      new Response("<html><body>nada conocido</body></html>")) as unknown as typeof fetch;
    await expect(conarteConnector(otroSitio, 3).fetchEvents()).rejects.toThrow(/markup desconocido/);
  });

  it("lanza error en HTTP no-200 del listado", async () => {
    const f = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(conarteConnector(f, 1).fetchEvents()).rejects.toThrow("503");
  });

  it("si todos los detalles fallan, revienta en vez de reportar cero", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-05T12:00:00Z"));
    const { fn } = fakeFetch({ "20260805": dia }); // sin detalles: 404
    await expect(conarteConnector(fn, 1).fetchEvents()).rejects.toThrow(/ningún detalle/);
  });
});
