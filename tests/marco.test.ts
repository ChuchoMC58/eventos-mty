import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  marcoConnector,
  parseListado,
  parseDiaEncabezado,
  parseHoras,
  parsePrecio,
} from "@/lib/ingest/sources/marco";

const listado = readFileSync(path.join(__dirname, "fixtures", "marco.html"), "utf8");

function fakeFetch(porUrl: Record<string, { body: string; status?: number }>) {
  return (async (url: string) => {
    const hit = porUrl[url];
    if (!hit) return new Response("", { status: 404 });
    return new Response(hit.body, { status: hit.status ?? 200 });
  }) as unknown as typeof fetch;
}

const soloPrimera = fakeFetch({ "https://www.marco.org.mx/eventos/": { body: listado } });

afterEach(() => vi.useRealTimers());

describe("parseo de piezas", () => {
  it("lee el día del encabezado de grupo", () => {
    expect(parseDiaEncabezado("Lunes 10 de agosto 2026")).toEqual({ y: 2026, m: 8, d: 10 });
    expect(parseDiaEncabezado("Miércoles 12 de agosto 2026")).toEqual({ y: 2026, m: 8, d: 12 });
    expect(parseDiaEncabezado("Del 10 de agosto al 30 de septiembre")).toBeNull();
  });

  it("lee hora suelta y rango", () => {
    expect(parseHoras("Miércoles 17:00 hrs")).toEqual({ inicio: "17:00" });
    expect(parseHoras("Domingo 12:00 a 14:00 hrs")).toEqual({ inicio: "12:00", fin: "14:00" });
    expect(parseHoras("Del 10 de agosto al 30 de septiembre")).toBeNull();
  });

  // Regla 4: gratis es un dato, ausente es "no sé". Colapsarlos hace que la web
  // diga "desde $0" o que se pierda el "Gratis".
  it("distingue gratis de sin precio", () => {
    expect(parsePrecio("Evento gratuito")).toEqual({ min: 0 });
    expect(parsePrecio("$500 MXN")).toEqual({ min: 500 });
    expect(parsePrecio("$1,400 - 3,000 MXN")).toEqual({ min: 1400, max: 3000 });
    expect(parsePrecio("")).toEqual({});
  });
});

describe("parseListado", () => {
  it("saca los eventos del listado real", () => {
    const r = parseListado(listado);
    expect(r.reconocible).toBe(true);
    expect(r.eventos.length).toBeGreaterThan(0);
    const conv = r.eventos.find((e) => e.title.includes("Wendy Cabrera"));
    expect(conv).toBeDefined();
    expect(conv!.category).toBe("cultura");
    expect(conv!.venue.name).toBe("MARCO");
    expect(conv!.priceMin).toBe(0);
    expect(conv!.ticketUrl).toMatch(/^https:\/\/www\.marco\.org\.mx\/eventos\//);
  });

  // El curso de varios meses ("Del 10 de agosto al 30 de septiembre") no trae
  // hora: es una inscripción abierta, no un evento de un día.
  it("descarta y cuenta las entradas sin hora", () => {
    const r = parseListado(listado);
    expect(r.sinHora).toBeGreaterThan(0);
    expect(r.eventos.some((e) => e.title.includes("Cursos y Talleres"))).toBe(false);
  });

  it("un HTML sin encabezados de día no es reconocible", () => {
    expect(parseListado("<html><body><p>hola</p></body></html>").reconocible).toBe(false);
  });
});

describe("fechas bajo distintas zonas horarias", () => {
  // La hora del sitio es *timezone-naive* en hora de Monterrey. Un parseo ingenuo
  // (`new Date(naive)`) funciona en prod —que corre en America/Monterrey— y falla
  // en local, que es el peor modo de fallar. Se fija la del proceso y se comprueba
  // que el instante no cambia.
  for (const tz of ["UTC", "America/Monterrey", "Asia/Tokyo"]) {
    it(`el conversatorio de las 17:00 cae en el mismo instante con TZ=${tz}`, () => {
      const previa = process.env.TZ;
      process.env.TZ = tz;
      try {
        const conv = parseListado(listado).eventos.find((e) => e.title.includes("Wendy Cabrera"))!;
        expect(conv.startsAt.toISOString()).toBe("2026-08-12T23:00:00.000Z");
      } finally {
        process.env.TZ = previa;
      }
    });
  }
});

describe("marcoConnector", () => {
  // El conector descarta lo ya pasado, así que sin congelar el reloj estos tests
  // se vaciarían solos cuando el fixture envejezca.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00Z"));
  });

  // 🔴 `/eventos/page/2/` responde 404: la paginación real es una ruta REST del
  // tema. Si alguien "simplifica" el conector a la URL de la paginación, se pierde
  // la segunda página sin que nada falle.
  it("pagina por la ruta REST del tema, no por /eventos/page/N/", async () => {
    const urls: string[] = [];
    const fn = (async (url: string) => {
      urls.push(url);
      if (url === "https://www.marco.org.mx/eventos/") return new Response(listado, { status: 200 });
      return new Response("<div><p>No se encontraron eventos.</p></div>", { status: 200 });
    }) as unknown as typeof fetch;
    await marcoConnector(fn).fetchEvents();
    expect(urls[1]).toBe("https://www.marco.org.mx/wp-json/eventos/v1/filtrar?paged=2");
  });

  it("deduplica por URL entre páginas", async () => {
    const events = await marcoConnector(
      fakeFetch({
        "https://www.marco.org.mx/eventos/": { body: listado },
        // La ruta repite el mismo contenido: no debe duplicar.
        "https://www.marco.org.mx/wp-json/eventos/v1/filtrar?paged=2": { body: listado },
      }),
    ).fetchEvents();
    const urls = events.map((e) => e.ticketUrl);
    expect(new Set(urls).size).toBe(urls.length);
    expect(events.length).toBeGreaterThan(0);
  });

  it("descarta lo que ya pasó", async () => {
    vi.setSystemTime(new Date("2026-08-25T12:00:00Z"));
    const events = await marcoConnector(soloPrimera).fetchEvents();
    expect(events.every((e) => e.startsAt > new Date("2026-08-25T12:00:00Z"))).toBe(true);
    expect(events.some((e) => e.title.includes("Wendy Cabrera"))).toBe(false);
  });

  it("se detiene en el 404 de la página siguiente", async () => {
    const events = await marcoConnector(soloPrimera).fetchEvents();
    expect(events.length).toBeGreaterThan(0);
  });

  // Regla 1: una fuente que se apaga en silencio es peor que una que revienta.
  it("revienta si el tema del sitio cambia (sin encabezados de día)", async () => {
    const fn = fakeFetch({ "https://www.marco.org.mx/eventos/": { body: "<html>otra cosa</html>" } });
    await expect(marcoConnector(fn).fetchEvents()).rejects.toThrow(/encabezados de día/);
  });

  it("revienta si la página tiene la forma esperada pero no sale un evento", async () => {
    const soloEncabezados = `<h2 class="evento-group-header">Lunes 10 de agosto 2026</h2><div></div>`;
    const fn = fakeFetch({ "https://www.marco.org.mx/eventos/": { body: soloEncabezados } });
    await expect(marcoConnector(fn).fetchEvents()).rejects.toThrow(/cero eventos parseados/);
  });

  it("propaga un HTTP no-200 que no sea 404", async () => {
    const fn = fakeFetch({ "https://www.marco.org.mx/eventos/": { body: "", status: 500 } });
    await expect(marcoConnector(fn).fetchEvents()).rejects.toThrow("500");
  });
});
