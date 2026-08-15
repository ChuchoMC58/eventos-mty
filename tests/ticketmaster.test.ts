import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { ticketmasterConnector } from "@/lib/ingest/sources/ticketmaster";

const fixture = readFileSync(path.join(__dirname, "fixtures", "ticketmaster.json"), "utf8");

function fakeFetch(body: string, status = 200) {
  return (async () => new Response(body, { status })) as unknown as typeof fetch;
}

/** Devuelve un cuerpo distinto por llamada y guarda las URLs pedidas. */
function fetchPorPagina(cuerpos: string[]) {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(url);
    return new Response(cuerpos[urls.length - 1] ?? cuerpos[cuerpos.length - 1], { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, urls };
}

function evento(nombre: string, stateCode?: string) {
  return {
    name: nombre,
    dates: { start: { dateTime: "2026-08-22T19:00:00Z" }, status: { code: "onsale" } },
    classifications: [{ segment: { name: "Music" }, genre: { name: "Rock" } }],
    _embedded: { venues: [{ name: `Venue de ${nombre}`, state: stateCode ? { stateCode } : undefined }] },
  };
}

describe("ticketmasterConnector", () => {
  process.env.TICKETMASTER_API_KEY = "test-key";

  it("mapea segmentos a categorías y descarta los desconocidos", async () => {
    const events = await ticketmasterConnector(fakeFetch(fixture)).fetchEvents();
    expect(events).toHaveLength(2);
    expect(events[0].category).toBe("deportes");
    expect(events[0].tags).toContain("soccer");
    expect(events[0].venue.name).toBe("Estadio BBVA");
    expect(events[0].priceMin).toBe(300);
    expect(events[0].priceMax).toBe(2500);
    expect(events[1].category).toBe("cultura");
    expect(events[1].status).toBe("cancelado");
  });

  it("lanza error en HTTP no-200 (para que el runner lo registre)", async () => {
    await expect(ticketmasterConnector(fakeFetch("{}", 500)).fetchEvents()).rejects.toThrow("500");
  });

  // El bug real: `city=Monterrey` deja fuera el Estadio BBVA (Guadalupe) y el
  // Foro Corona ("Col. Centro Monterrey"), que son 41 de 131 eventos. Si alguien
  // "simplifica" la consulta de vuelta a la ciudad, esto tiene que reventar.
  it("consulta por geohash y radio, no por ciudad", async () => {
    const { fn, urls } = fetchPorPagina([fixture]);
    await ticketmasterConnector(fn).fetchEvents();
    expect(urls[0]).toContain("geoPoint=");
    expect(urls[0]).toContain("radius=30");
    expect(urls[0]).toContain("unit=km");
    expect(urls[0]).not.toContain("city=");
  });

  it("pagina hasta traer todo (la consulta vieja truncaba en silencio)", async () => {
    const pagina = (nombres: string[], number: number) =>
      JSON.stringify({
        _embedded: { events: nombres.map((n) => evento(n, "NL")) },
        page: { totalElements: 3, totalPages: 3, number },
      });
    const { fn, urls } = fetchPorPagina([
      pagina(["uno"], 0),
      pagina(["dos"], 1),
      pagina(["tres"], 2),
    ]);
    const events = await ticketmasterConnector(fn).fetchEvents();
    expect(events.map((e) => e.title)).toEqual(["uno", "dos", "tres"]);
    expect(urls).toHaveLength(3);
    expect(urls[2]).toContain("page=2");
  });

  it("revienta si el filtro geográfico deja de aplicarse", async () => {
    const cuerpo = JSON.stringify({
      _embedded: {
        events: [evento("regio", "NL"), evento("chilango", "CMX"), evento("tapatío", "JAL")],
      },
      page: { totalElements: 3, totalPages: 1, number: 0 },
    });
    await expect(ticketmasterConnector(fakeFetch(cuerpo)).fetchEvents()).rejects.toThrow(
      /fuera de Nuevo León/,
    );
  });

  it("no revienta cuando los venues no declaran estado (fixtures viejos)", async () => {
    const events = await ticketmasterConnector(fakeFetch(fixture)).fetchEvents();
    expect(events).toHaveLength(2);
  });
});
