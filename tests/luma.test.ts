import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { lumaConnector, mapLumaEntry as mapear, categoriaDe, LumaEntry } from "@/lib/ingest/sources/luma";
import { NormalizedEvent } from "@/lib/events/types";

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "luma.json"), "utf8"),
) as { entries: LumaEntry[] };

// Los api_id de las 8 categorías de Luma (FUENTES.md). Cuatro son slugs
// legibles y cuatro son ids opacos; no hay patrón, hay que copiarlos tal cual.
const CAT = {
  arts: "cat-AzVAf6VmE9JEre4",
  tech: "cat-tech",
  ai: "cat-ai",
  crypto: "cat-crypto",
  fitness: "cat-0Km9ZnuBjFAjwFl",
  wellness: "cat-C1VaNLnt25w9t6c",
  climate: "cat-climate",
  comida: "cat-fooddrink",
};

function fakeFetch(paginas: unknown[]) {
  const urls: string[] = [];
  let i = 0;
  const fn = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(paginas[Math.min(i++, paginas.length - 1)]));
  }) as unknown as typeof fetch;
  return { fn, urls };
}

/**
 * El barrido pide una vez por categoría más el feed sin filtro, y cada consulta
 * devuelve lo suyo. `sinFiltro` es lo que sale sólo en el feed general.
 */
function fetchPorCategoria(porCategoria: Partial<Record<string, LumaEntry[]>>, sinFiltro: LumaEntry[] = []) {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(url);
    const m = /discover_category_api_id=([^&]+)/.exec(url);
    const entries = m ? (porCategoria[m[1]] ?? []) : [...Object.values(porCategoria).flat(), ...sinFiltro];
    return new Response(JSON.stringify({ entries, has_more: false, next_cursor: null }));
  }) as unknown as typeof fetch;
  return { fn, urls };
}

const unaPagina = { entries: fixture.entries, has_more: false, next_cursor: null };
const porTitulo = (eventos: NormalizedEvent[], frag: string) =>
  eventos.find((e) => e.title.includes(frag))!;

/** Un evento del área con otro id y otro título, para armar casos por categoría. */
function clon(api_id: string, name: string): LumaEntry {
  const e = JSON.parse(JSON.stringify(fixture.entries[1])) as LumaEntry;
  e.event!.api_id = api_id;
  e.event!.name = name;
  return e;
}

describe("mapLumaEntry", () => {
  const [paranormal, curso, phoebe, santos, pagado, bolishe, boston] = fixture.entries;
  // Todo el fixture salió de la consulta de Arts & Culture, que es lo que el
  // conector le pasaría al mapear.
  const mapLumaEntry = (entry: LumaEntry) => mapear(entry, ["arts & culture"]);

  it("el nombre de la sede sale de `address` (la calle es short_address)", () => {
    const e = mapLumaEntry(santos)!;
    expect(e.venue.name).toBe("Casa Dam");
    expect(e.venue.address).toMatch(/Rub/);
    expect(e.venue.zone).toBe("Cuauhtémoc");
    expect(e.city).toBe("monterrey"); // el evento es de San Nicolás: el área es metropolitana
  });

  it("descarta los eventos con sede oculta", () => {
    // Sin nombre real todos caerían en un mismo Venue falso y el dedupe
    // (venue + día + título similar) fusionaría eventos sin relación.
    expect(bolishe.event?.geo_address_info?.mode).toBe("obfuscated");
    expect(mapLumaEntry(bolishe)).toBeNull();
  });

  it("descarta lo que no es de Nuevo León", () => {
    expect(mapLumaEntry(boston)).toBeNull();
  });

  it("saca la música de Arts & Culture y deja el resto en cultura", () => {
    expect(mapLumaEntry(paranormal)!.category).toBe("musica"); // "listening party"
    expect(mapLumaEntry(phoebe)!.category).toBe("musica");
    expect(mapLumaEntry(pagado)!.category).toBe("musica"); // "Concierto"
    expect(mapLumaEntry(curso)!.category).toBe("cultura");
  });

  it("conserva la categoría original en tags y marca lo agotado", () => {
    expect(mapLumaEntry(curso)!.tags).toEqual(["arts & culture"]);
    // Agotado no es cancelado: el evento sigue en pie.
    expect(mapLumaEntry(paranormal)!.tags).toEqual(["arts & culture", "agotado"]);
    expect(mapLumaEntry(paranormal)!.status).toBe("activo");
  });

  it("gratis es 0 y los centavos se vuelven pesos", () => {
    expect(mapLumaEntry(curso)!.priceMin).toBe(0);
    expect(mapLumaEntry(pagado)!.priceMin).toBe(250);
    expect(mapLumaEntry(pagado)!.priceMax).toBe(600);
    // De pago pero sin monto publicado: "no sé el precio", que no es gratis.
    expect(mapLumaEntry(paranormal)!.priceMin).toBeUndefined();
  });

  it("ignora precios que no son en pesos", () => {
    const enDolares = JSON.parse(JSON.stringify(pagado)) as LumaEntry;
    enDolares.ticket_info!.price = { cents: 4000, currency: "usd" };
    expect(mapLumaEntry(enDolares)!.priceMin).toBeUndefined();
  });

  it("arma la URL a partir del slug y respeta las fechas UTC", () => {
    const e = mapLumaEntry(santos)!;
    expect(e.ticketUrl).toBe("https://luma.com/irugds6h");
    expect(e.startsAt.toISOString()).toBe("2026-08-16T01:30:00.000Z");
    expect(e.endsAt?.toISOString()).toBe("2026-08-16T05:00:00.000Z");
  });

  it("descarta una hora de fin de semanas después (un curso, no un evento largo)", () => {
    // El curso de corte y confección corre del 10-ago al 4-sep en una sola entrada.
    expect(curso.event?.end_at).toBe("2026-09-04T23:00:00.000Z");
    expect(mapLumaEntry(curso)!.endsAt).toBeUndefined();
    expect(mapLumaEntry(santos)!.endsAt).toBeDefined(); // 3.5 h: sí se guarda
  });

  it("descarta una 'sede' que en realidad es la ciudad", () => {
    const falsa = JSON.parse(JSON.stringify(santos)) as LumaEntry;
    const geo = falsa.event!.geo_address_info!;
    geo.address = "Monterrey";
    geo.city = "Monterrey";
    geo.localized = { es: { address: "Monterrey", city: "Monterrey" } };
    expect(mapLumaEntry(falsa)).toBeNull();
  });
});

describe("categoriaDe", () => {
  it("prioriza lo específico cuando el evento sale en varias categorías", () => {
    // Medido: 2 de 19 salen en Fitness *y* Wellness. Sin prioridad explícita la
    // categoría dependería del orden de los `for`.
    expect(categoriaDe(["fitness", "wellness"], "Diplomado Pilates")).toBe("bienestar");
    expect(categoriaDe(["arts & culture", "tech"], "Charla de fintech")).toBe("cultura");
    expect(categoriaDe(["tech", "ai", "crypto"], "Founder Bootcamp")).toBe("tecnologia");
  });

  it("la heurística de música sólo corre dentro de Arts & Culture", () => {
    // "showcase" es palabra de concierto y de startups a la vez: fuera de Arts &
    // Culture, dejarla suelta convertiría un demo day en un concierto.
    expect(categoriaDe(["tech"], "Startup Showcase Monterrey")).toBe("tecnologia");
    expect(categoriaDe(["arts & culture"], "Showcase de bandas locales")).toBe("musica");
  });

  it("la música le gana a todo lo demás", () => {
    expect(categoriaDe(["arts & culture", "fitness"], "Concierto de cámara")).toBe("musica");
  });

  it("sin categoría en el origen: por título, y si no, cultura", () => {
    expect(categoriaDe([], "Tocada en Casa Dam")).toBe("musica");
    // El único caso real medido. Antes caía en `cultura` por descarte.
    expect(categoriaDe([], "OWWR's Taylor Swift-Themed Run")).toBe("bienestar");
    expect(categoriaDe([], "Kermés del barrio")).toBe("cultura");
  });

  it("la heurística de bienestar no pisa lo que la fuente sí clasifica", () => {
    // "Rundown de la semana" en un meetup de tech es tecnología, no un club de
    // correr: fuera del fallback, manda la categoría de la fuente.
    expect(categoriaDe(["tech"], "Rundown semanal: yoga para devs")).toBe("tecnologia");
  });
});

describe("lumaConnector", () => {
  // Los avisos del conector son console.warn a propósito (el reporte de ingesta
  // los imprime). Aquí se silencian para no ensuciar la corrida, pero se leen:
  // `mockRestore` borra las llamadas, así que hay que consultarlas dentro del test.
  let warn: MockInstance<typeof console.warn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());
  const avisos = () => warn.mock.calls.flat().join(" ");

  it("pide las 8 categorías y el feed sin filtro, con los parámetros que la API sí lee", async () => {
    const { fn, urls } = fakeFetch([unaPagina]);
    await lumaConnector(fn).fetchEvents();
    expect(urls).toHaveLength(9);
    // lat/lng, category_api_id y cursor se ignoran EN SILENCIO y devuelven 200.
    expect(urls.every((u) => u.includes("latitude=25.6866") && u.includes("longitude=-100.3161"))).toBe(true);
    for (const id of Object.values(CAT)) {
      expect(urls.some((u) => u.includes(`discover_category_api_id=${id}`))).toBe(true);
    }
    // El feed sin filtro va al final: los ya vistos conservan su categoría.
    expect(urls[8]).not.toContain("discover_category_api_id");
  });

  it("trae sólo los aprovechables del área", async () => {
    const { fn } = fetchPorCategoria({ [CAT.arts]: fixture.entries });
    const eventos = await lumaConnector(fn).fetchEvents();
    // 7 en el fixture − 1 con sede oculta − 1 de Boston.
    expect(eventos).toHaveLength(5);
    expect(porTitulo(eventos, "Santos de la Rosa").venue.name).toBe("Casa Dam");
    expect(eventos.every((e) => e.city === "monterrey")).toBe(true);
  });

  it("un evento que sale en dos categorías se ingiere una sola vez", async () => {
    const pilates = clon("evt-pilates", "Diplomado Pilates Reformer");
    const { fn } = fetchPorCategoria({ [CAT.fitness]: [pilates], [CAT.wellness]: [pilates] });
    const eventos = await lumaConnector(fn).fetchEvents();
    // Sin dedupe por api_id el upsert los fusionaría de todos modos, pero con la
    // categoría de la última consulta que ganara la carrera.
    expect(eventos).toHaveLength(1);
    expect(eventos[0].category).toBe("bienestar");
    expect(eventos[0].tags).toEqual(["fitness", "wellness"]);
  });

  it("lo que Luma no clasifica no se pierde, y lo avisa", async () => {
    // Medido: 1 de 19 (un club de correr) no sale en NINGUNA de las 8 consultas,
    // sólo en el feed sin filtro.
    const run = clon("evt-run", "OWWR's Taylor Swift-Themed Run");
    const { fn } = fetchPorCategoria({ [CAT.arts]: [fixture.entries[3]] }, [run]);
    const eventos = await lumaConnector(fn).fetchEvents();

    expect(eventos).toHaveLength(2);
    const suelto = porTitulo(eventos, "OWWR");
    expect(suelto.tags).toEqual([]); // no hay categoría de origen que conservar
    expect(avisos()).toContain("OWWR");
  });

  it("avisa la primera vez que Climate o Food & Drink traen algo", async () => {
    // Su destino se decidió con una muestra del feed global, sin un solo caso de
    // Monterrey: cuando llegue el primero hay que volver a mirarlo.
    const demoDay = clon("evt-climate", "Tough Tech Demo Day");
    const { fn } = fetchPorCategoria({ [CAT.climate]: [demoDay] });
    const eventos = await lumaConnector(fn).fetchEvents();

    expect(eventos[0].category).toBe("tecnologia");
    expect(avisos()).toContain("climate");
    expect(avisos()).toContain("Tough Tech Demo Day");
  });

  it("pagina con pagination_cursor (no con next_cursor, que repite la página 1)", async () => {
    const p1 = { entries: fixture.entries.slice(0, 1), has_more: true, next_cursor: "cur-2" };
    const p2 = { entries: fixture.entries.slice(1, 2), has_more: false, next_cursor: null };
    const { fn, urls } = fakeFetch([p1, p2]);
    const eventos = await lumaConnector(fn).fetchEvents();
    expect(urls[1]).toContain("pagination_cursor=cur-2");
    // La 1.ª consulta gastó 2 páginas; las otras 8, una cada una.
    expect(urls).toHaveLength(10);
    expect(eventos).toHaveLength(2); // los mismos dos, deduplicados entre consultas
  });

  it("no gira infinito si el cursor deja de avanzar", async () => {
    // Si el parámetro cambiara de nombre, la API devolvería siempre la página 1.
    const pegado = { entries: fixture.entries.slice(0, 1), has_more: true, next_cursor: "mismo" };
    const { fn, urls } = fakeFetch([pegado]);
    await lumaConnector(fn).fetchEvents();
    // Dos páginas por consulta: la 2.ª repite el cursor y ahí corta, muy antes
    // del tope de 20. Y el corte es POR consulta — una categoría atorada no se
    // consume el presupuesto de las otras ocho.
    expect(urls).toHaveLength(9 * 2);
  });

  it("revienta si nada es de Nuevo León (señal de que se ignoraron las coordenadas)", async () => {
    // Sin coordenadas la API geolocaliza por IP y el VPS aterriza en Boston.
    const soloBoston = { entries: [fixture.entries[6]], has_more: false, next_cursor: null };
    const { fn } = fakeFetch([soloBoston]);
    await expect(lumaConnector(fn).fetchEvents()).rejects.toThrow(/Nuevo León/);
  });

  it("un área sin eventos NO es error", async () => {
    const { fn } = fakeFetch([{ entries: [], has_more: false, next_cursor: null }]);
    await expect(lumaConnector(fn).fetchEvents()).resolves.toEqual([]);
  });

  it("lanza error en HTTP no-200 (para que el runner lo registre)", async () => {
    const f = (async () => new Response("{}", { status: 429 })) as unknown as typeof fetch;
    await expect(lumaConnector(f).fetchEvents()).rejects.toThrow("429");
  });
});
