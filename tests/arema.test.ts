import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { aremaConnector, categoryFrom, mapAremaEvento } from "@/lib/ingest/sources/arema";

const lista = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "arema-lista.json"), "utf8"));
const detalles = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "arema-detalles.json"), "utf8"));

// 2026-08-07 06:00 en Monterrey. Los eventos del fixture cuelgan de esta fecha.
const AHORA = new Date("2026-08-07T12:00:00.000Z");

/**
 * Enruta por ruta y por cuerpo, que es como habla el conector: un POST al
 * listado y uno por evento al detalle. `opts.detalle` permite romper la etapa 2
 * sin tocar la 1.
 */
function fakeFetch(opts: { lista?: unknown; detalle?: "falla" | "vacio"; status?: number } = {}) {
  return (async (url: string, init?: RequestInit) => {
    if (url.endsWith("/events/list")) {
      return new Response(JSON.stringify(opts.lista ?? lista), { status: opts.status ?? 200 });
    }
    if (url.endsWith("/events/get")) {
      if (opts.detalle === "falla") {
        return new Response(JSON.stringify({ error: true, code: "UNXEND", message: "Unexpected Endpoint" }));
      }
      if (opts.detalle === "vacio") return new Response(JSON.stringify({ error: false, data: { dates: [] } }));
      const id = String(JSON.parse(String(init?.body ?? "{}")).event_id);
      return new Response(JSON.stringify(detalles[id] ?? { error: true, code: "NOTFND" }));
    }
    throw new Error(`URL inesperada: ${url}`);
  }) as unknown as typeof fetch;
}

const correr = (o = {}) => aremaConnector(fakeFetch(o), () => AHORA).fetchEvents();

afterEach(() => vi.restoreAllMocks());

describe("categoryFrom", () => {
  it("mapea las categorías propias de Arema", () => {
    expect(categoryFrom({ category_name: "Concierto" })).toBe("musica");
    expect(categoryFrom({ category_name: "Teatro" })).toBe("cultura");
    expect(categoryFrom({ category_name: "Comediantes" })).toBe("cultura");
    expect(categoryFrom({ category_name: "Deportes" })).toBe("deportes");
  });

  it("los cajones de marketing caen en cultura, no en música", () => {
    // "Especiales" y "Familiares" son un rodeo, un drag tour y una feria.
    expect(categoryFrom({ category_name: "Especiales" })).toBe("cultura");
    expect(categoryFrom({ category_name: "Familiares" })).toBe("cultura");
  });

  it("lo desconocido cae en cultura: aquí la música sí tiene etiqueta propia", () => {
    // Al revés que en Superboletos, donde el default es música porque el género
    // musical viene disfrazado de mil formas.
    expect(categoryFrom({ category_name: "Categoría Que No Existe" })).toBe("cultura");
    expect(categoryFrom({ category_name: null })).toBe("cultura");
    expect(categoryFrom({})).toBe("cultura");
  });
});

describe("mapAremaEvento", () => {
  const base = {
    event_id: 999,
    event_name: "  UN SHOW  ",
    category_name: "Concierto",
    date: Math.floor(Date.UTC(2026, 8, 4, 2, 0, 0) / 1000),
    venue_name: "Café Iguana",
    city: "Monterrey",
    state: "Nuevo León",
  };

  // El campo `date` es epoch en SEGUNDOS y en UTC de verdad, no una hora local
  // disfrazada: por eso este conector NO usa `fechaZonaAUtc` como CONARTE o
  // Superboletos. Se corre bajo tres zonas para que un `new Date` mal escrito
  // (que pasaría en prod, que corre en America/Monterrey) no se cuele.
  for (const tz of ["UTC", "America/Monterrey", "Asia/Tokyo"]) {
    it(`interpreta el epoch como UTC real, no según la TZ del proceso (TZ=${tz})`, () => {
      const original = process.env.TZ;
      process.env.TZ = tz;
      try {
        // 02:00 UTC = 20:00 del día anterior en Monterrey (UTC−6), la hora
        // típica de función.
        expect(mapAremaEvento(base, null, AHORA)[0].startsAt.toISOString()).toBe("2026-09-04T02:00:00.000Z");
      } finally {
        process.env.TZ = original;
      }
    });
  }

  it("sin detalle se queda con la fecha del listado en vez de perder el evento", () => {
    const ev = mapAremaEvento(base, null, AHORA);
    expect(ev).toHaveLength(1);
    expect(ev[0].title).toBe("UN SHOW");
  });

  it("expande la temporada y descarta funciones canceladas o ya pasadas", () => {
    const ev = mapAremaEvento(base, detalles["20420"].data, AHORA);
    // De 5 fechas: 3 futuras activas, 1 pasada, 1 con active:false.
    expect(ev.map((e) => e.startsAt.toISOString())).toEqual([
      "2026-09-04T02:00:00.000Z",
      "2026-09-05T02:00:00.000Z",
      "2026-09-06T00:00:00.000Z",
    ]);
  });

  it("no duplica una fecha repetida", () => {
    const repetida = { dates: [{ date: base.date, active: true }, { date: base.date, active: true }] };
    expect(mapAremaEvento(base, repetida, AHORA)).toHaveLength(1);
  });

  it("renombra sólo los venues que otra fuente ya trae con otro nombre", () => {
    const alias = (venue_name: string) => mapAremaEvento({ ...base, venue_name }, null, AHORA)[0].venue.name;
    expect(alias("Pabellon M")).toBe("Escenario GNP Seguros");
    expect(alias("Teatro de la Ciudad de Monterrey")).toBe("Teatro de la Ciudad");
    // El de San Nicolás es OTRO teatro: si se "normalizara" por parecido, sus
    // eventos se fusionarían con los del centro.
    expect(alias("Teatro de la Ciudad San Nicolás")).toBe("Teatro de la Ciudad San Nicolás");
    expect(alias("Café Iguana")).toBe("Café Iguana");
  });

  it("el municipio va en zone, salvo Monterrey mismo", () => {
    expect(mapAremaEvento(base, null, AHORA)[0].venue.zone).toBeUndefined();
    const foraneo = mapAremaEvento({ ...base, city: "Guadalupe" }, null, AHORA)[0];
    expect(foraneo.venue.zone).toBe("Guadalupe");
    expect(foraneo.city).toBe("monterrey");
  });

  it("arma ticketUrl e imagen a partir del id", () => {
    const ev = mapAremaEvento(base, null, AHORA)[0];
    expect(ev.ticketUrl).toBe("https://arema.mx/e/999");
    // El listado trae poster:null en los 96 de NL; la imagen se deriva del id.
    expect(ev.imageUrl).toBe("https://cdn.arema.dev/t3/events/999/800.webp");
  });

  it("una sinopsis vacía es undefined, no cadena vacía", () => {
    expect(mapAremaEvento(base, { sinopsis: "   " }, AHORA)[0].description).toBeUndefined();
    expect(mapAremaEvento(base, { sinopsis: "  Con María León  " }, AHORA)[0].description).toBe("Con María León");
  });

  it("descarta lo que no tiene título, recinto o id", () => {
    expect(mapAremaEvento({ ...base, event_name: "  " }, null, AHORA)).toEqual([]);
    expect(mapAremaEvento({ ...base, venue_name: "" }, null, AHORA)).toEqual([]);
    expect(mapAremaEvento({ ...base, event_id: undefined }, null, AHORA)).toEqual([]);
  });

  it("un evento sin ninguna fecha usable no emite nada", () => {
    expect(mapAremaEvento({ ...base, date: undefined }, { dates: [] }, AHORA)).toEqual([]);
  });
});

describe("aremaConnector", () => {
  it("deja pasar sólo los vigentes de Nuevo León", async () => {
    const titulos = [...new Set((await correr()).map((e) => e.title))];
    expect(titulos).toEqual([
      "Siete Veces Adios en Monterrey",
      "FLVCKKA en Monterrey",
      "Jedicon en Monterrey",
      "The Amazing Digital Circus El Ultimo Acto en San Nicolás",
      "Manolyn Fest en Zagar Comedy Bar San Nicolás",
    ]);
    expect(titulos).not.toContain("Hablemos De Lo Que No Existe en Puebla"); // otro estado
    expect(titulos).not.toContain("Tarde Nortena que ya paso en Monterrey"); // ya pasó
    expect(titulos).not.toContain("Evento sin recinto");
  });

  it("expande la temporada: 5 eventos del listado son 7 funciones", async () => {
    // "Siete Veces Adios" tiene tres funciones vigentes; el resto, una.
    expect(await correr()).toHaveLength(7);
  });

  it("un detalle caído degrada, no tumba la fuente", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const events = await correr({ detalle: "falla" });
    // Se pierden las funciones extra de la temporada, pero ningún evento.
    expect(events).toHaveLength(5);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[arema]"));
  });

  it("un evento cuyo detalle no trae fechas cae a la del listado", async () => {
    // "The Amazing Digital Circus" trae dates: [] en el fixture.
    const circo = (await correr()).find((e) => e.title.startsWith("The Amazing"));
    expect(circo?.startsAt.toISOString()).toBe("2026-11-15T20:00:00.000Z");
  });

  describe("detección de fallo", () => {
    it("revienta si la API responde 200 con un error en el cuerpo", async () => {
      // Su API NUNCA usa el status para fallar: sin esta comprobación, un
      // endpoint renombrado devolvería cero eventos y nadie se enteraría.
      await expect(correr({ lista: { error: true, code: "UNXEND", message: "Unexpected Endpoint" } })).rejects.toThrow(
        /UNXEND/,
      );
    });

    it("revienta si el catálogo viene vacío o cambia de forma", async () => {
      await expect(correr({ lista: { error: false, data: { events: [] } } })).rejects.toThrow(/vacío/);
      await expect(correr({ lista: { error: false, data: {} } })).rejects.toThrow(/vacío/);
    });

    it("revienta con un catálogo nacional sano pero casi nada en NL", async () => {
      // El colapso parcial que `hayCaida()` no ve: 648 eventos, 4 en el estado
      // porque renombraron el campo `state`.
      const events = Array.from({ length: 400 }, (_, i) => ({
        event_id: i + 1,
        event_name: `Evento ${i}`,
        category_name: "Concierto",
        date: Math.floor(AHORA.getTime() / 1000) + 86_400,
        venue_name: "Teatro Principal",
        city: "Heroica Puebla de Zaragoza",
        state: "Puebla",
      }));
      await expect(correr({ lista: { error: false, data: { events } } })).rejects.toThrow(/cambió el esquema/);
    });

    it("revienta si el listado responde con un status de error", async () => {
      await expect(correr({ status: 500 })).rejects.toThrow(/HTTP 500/);
    });
  });
});
