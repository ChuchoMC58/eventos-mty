import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  superboletosConnector,
  parseFechaSb,
  categoryFrom,
  mapSbEvent,
  resolverVersion,
} from "@/lib/ingest/sources/superboletos";

const fixture = readFileSync(path.join(__dirname, "fixtures", "superboletos.json"), "utf8");

// 2026-08-06 06:00 en Monterrey. Los eventos del fixture cuelgan de esta fecha.
const AHORA = new Date("2026-08-06T12:00:00.000Z");

const HOME_HTML = `<!DOCTYPE html><html><body>
  <script src="/_next/static/chunks/webpack-2f8fa8086bbdffd6.js"></script>
  <script src="/_next/static/chunks/pages/_app-3d217009c3e86bba.js"></script>
</body></html>`;
const APP_JS = `self.__NEXT_P=[];CDN:{NEXT_PUBLIC_CDN_BASE_URL:"https://dl09mj2qf37fz.cloudfront.net",NEXT_PUBLIC_CDN_CONTENT_VERSION:"27768"}`;

/** Enruta por URL: home → chunk → catálogo, que es lo que hace el conector. */
function fakeFetch(opts: { home?: string; app?: string; json?: string; status?: number } = {}) {
  return (async (url: string) => {
    if (url.endsWith("/_app-3d217009c3e86bba.js")) return new Response(opts.app ?? APP_JS);
    if (url.includes("search.json")) return new Response(opts.json ?? fixture, { status: opts.status ?? 200 });
    return new Response(opts.home ?? HOME_HTML);
  }) as unknown as typeof fetch;
}

const correr = (o = {}) => superboletosConnector(fakeFetch(o), () => AHORA).fetchEvents();

afterEach(() => vi.restoreAllMocks());

describe("parseFechaSb", () => {
  // El sitio publica hora local sin offset. Un `new Date(naive)` da resultados
  // distintos según la TZ del proceso: pasa en prod (America/Monterrey) y falla
  // en local. Por eso el mismo caso se corre bajo tres zonas.
  for (const tz of ["UTC", "America/Monterrey", "Asia/Tokyo"]) {
    it(`interpreta la hora en Monterrey, no en la del proceso (TZ=${tz})`, () => {
      const original = process.env.TZ;
      process.env.TZ = tz;
      try {
        // 19 de agosto 21:00 en Monterrey (UTC−6) = 20 de agosto 03:00 UTC
        expect(parseFechaSb("19 de Agosto 21:00 Hrs.", AHORA)?.toISOString()).toBe("2026-08-20T03:00:00.000Z");
      } finally {
        process.env.TZ = original;
      }
    });
  }

  it("usa el año explícito cuando viene", () => {
    expect(parseFechaSb("02 de Abril de 2022 21:00 Hrs.", AHORA)?.toISOString()).toBe("2022-04-03T03:00:00.000Z");
  });

  it("sin año asume el año en curso", () => {
    expect(parseFechaSb("26 de Noviembre 20:30 Hrs.", AHORA)?.getUTCFullYear()).toBe(2026);
  });

  it("sin año, una fecha muy atrasada se lee como del año siguiente", () => {
    // En diciembre, un anuncio de "15 de Enero" es del enero que viene, no del
    // que ya pasó. Sin esta regla el evento se descartaría por pasado.
    const enDiciembre = new Date("2026-12-20T18:00:00.000Z");
    expect(parseFechaSb("15 de Enero 21:00 Hrs.", enDiciembre)?.getUTCFullYear()).toBe(2027);
  });

  it("no reinterpreta una fecha apenas pasada", () => {
    // Dentro de la gracia de 60 días sigue siendo del año en curso; el filtro de
    // pasados es quien la descarta, no el parser.
    expect(parseFechaSb("06 de Agosto 21:00 Hrs.", new Date("2026-08-20T12:00:00.000Z"))?.getUTCFullYear()).toBe(2026);
  });

  it("descarta rangos, basura y meses inexistentes", () => {
    expect(parseFechaSb("Del Jue. 21 al Dom. 24 Mayo", AHORA)).toBeNull();
    expect(parseFechaSb(",,", AHORA)).toBeNull();
    expect(parseFechaSb("", AHORA)).toBeNull();
    expect(parseFechaSb(undefined, AHORA)).toBeNull();
    expect(parseFechaSb("02 y 03 Octubre", AHORA)).toBeNull();
    expect(parseFechaSb("15 de Brumario 21:00 Hrs.", AHORA)).toBeNull();
  });

  it("no deja que un día inexistente ruede al mes siguiente", () => {
    // Date.UTC(2026, 1, 31) es 3 de marzo: un rollover silencioso inventaría una
    // fecha plausible y equivocada.
    expect(parseFechaSb("31 de Febrero 21:00 Hrs.", AHORA)).toBeNull();
    expect(parseFechaSb("31 de Enero 21:00 Hrs.", AHORA)).not.toBeNull();
  });
});

describe("categoryFrom", () => {
  it("el género manda sobre el tipo: 'Familiares' es un cajón de marketing", () => {
    // Melanie Martinez viene como Familiares; es un concierto.
    expect(categoryFrom({ claveTipoEvento: "Familiares", claveGenero: "MUSICAL" })).toBe("musica");
  });

  it("clasifica deportes y cultura por género", () => {
    expect(categoryFrom({ claveTipoEvento: "Deportes", claveGenero: "LUCHA_LIBRE" })).toBe("deportes");
    expect(categoryFrom({ claveTipoEvento: "Expos y conferencia", claveGenero: "MOTIVACION" })).toBe("cultura");
    expect(categoryFrom({ claveTipoEvento: "Festivales", claveGenero: "EXPOSICION" })).toBe("cultura");
  });

  it("cae al tipo cuando el género no dice nada, y a música al final", () => {
    expect(categoryFrom({ claveTipoEvento: "Teatro y musicales", claveGenero: "" })).toBe("cultura");
    expect(categoryFrom({ claveTipoEvento: "", claveGenero: "GRUPERO" })).toBe("musica");
  });
});

describe("mapSbEvent", () => {
  const base = {
    eventoId: "abc123",
    nombreEvento: "  UN CONCIERTO  ",
    nombreRecinto: "Arena Monterrey",
    nombreCiudad: "Monterrey",
    claveTipoEvento: "Conciertos",
    claveGenero: "ESPAÑOL",
    fechas: "19 de Agosto 21:00 Hrs.",
    precioMinimo: "0",
    precioMaximo: "0",
  };

  it("un precio 0 es 'no sé', no 'gratis'", () => {
    // Al revés que en CONARTE: los 84 vigentes traen 0 y copiarlo pintaría toda
    // la cartelera como entrada libre.
    const ev = mapSbEvent(base, AHORA)!;
    expect(ev.priceMin).toBeUndefined();
    expect(ev.priceMax).toBeUndefined();
  });

  it("sí usa el precio si algún día lo publican", () => {
    const ev = mapSbEvent({ ...base, precioMinimo: "450", precioMaximo: "1800" }, AHORA)!;
    expect(ev.priceMin).toBe(450);
    expect(ev.priceMax).toBe(1800);
  });

  it("conserva el nombre del venue exacto (de eso vive el dedupe)", () => {
    expect(mapSbEvent(base, AHORA)!.venue.name).toBe("Arena Monterrey");
  });

  it("el municipio va en zone, salvo Monterrey mismo", () => {
    expect(mapSbEvent(base, AHORA)!.venue.zone).toBeUndefined();
    expect(mapSbEvent({ ...base, nombreCiudad: "San Pedro Garza García" }, AHORA)!.venue.zone).toBe(
      "San Pedro Garza García",
    );
  });

  it("descarta lo que no tiene título, recinto o id", () => {
    expect(mapSbEvent({ ...base, nombreEvento: "  " }, AHORA)).toBeNull();
    expect(mapSbEvent({ ...base, nombreRecinto: "" }, AHORA)).toBeNull();
    expect(mapSbEvent({ ...base, eventoId: "" }, AHORA)).toBeNull();
  });
});

describe("superboletosConnector", () => {
  it("deja pasar sólo los vigentes de Nuevo León", async () => {
    const events = await correr();
    expect(events.map((e) => e.title)).toEqual([
      "LUX TOUR 2026: ROSALIA",
      "MELANIE MARTINEZ - HADES: THE SACRIFICE",
      "WWE MEXICO TOUR MONTERREY",
      "OF MONSTERS AND MEN",
      "DANIEL HABIF - ASCENDER",
    ]);
  });

  it("descarta cancelados, pasados, rangos, basura y otros estados", async () => {
    const titulos = (await correr()).map((e) => e.title);
    expect(titulos).not.toContain("TATIVERSO CHICHARRIN"); // CANCELADO aunque sea futuro
    expect(titulos).not.toContain("THE BOYBAND EXPERIENCE"); // 2022
    expect(titulos).not.toContain("THE BOOK OF MORMON"); // rango sin año
    expect(titulos).not.toContain("CATS"); // fechas ",,"
    expect(titulos).not.toContain("MATUTE EN QUERETARO MARIACHELAA"); // Querétaro
  });

  it("arma ticketUrl e imagen y clasifica bien", async () => {
    const [rosalia, melanie, wwe] = await correr();
    expect(rosalia.ticketUrl).toMatch(/^https:\/\/www\.superboletos\.com\/landing-evento\/.+/);
    expect(rosalia.imageUrl).toMatch(/^https:\/\//);
    expect(rosalia.category).toBe("musica");
    expect(melanie.category).toBe("musica"); // viene como "Familiares"
    expect(wwe.category).toBe("deportes");
    expect(rosalia.city).toBe("monterrey");
    expect(rosalia.status).toBe("activo");
  });

  it("avisa cuántos descartó por fecha", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await correr();
    // De 9 NORMAL, 4 son de NL y se caen por fecha (rango, ",,", 2022) o por
    // estado; el aviso evita que el descarte crezca sin que nadie se entere.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[superboletos]"));
  });

  describe("detección de fallo", () => {
    it("revienta si la home ya no referencia el chunk", async () => {
      await expect(correr({ home: "<html><body>rediseño</body></html>" })).rejects.toThrow(/chunk _app/);
    });

    it("revienta si el chunk ya no declara la versión del CDN", async () => {
      await expect(correr({ app: "self.__NEXT_P=[];" })).rejects.toThrow(/CDN_CONTENT_VERSION/);
    });

    it("revienta si el catálogo responde error o viene vacío", async () => {
      await expect(correr({ status: 500 })).rejects.toThrow(/HTTP 500/);
      await expect(correr({ json: "[]" })).rejects.toThrow(/vacío/);
    });

    it("revienta si el catálogo nacional viene sano pero NL colapsa", async () => {
      // El caso que hayCaida() NO ve: no es una caída a cero, es un 84 → 3
      // porque cambió el nombre de un campo. Con el catálogo por encima de 100
      // registros, menos de 20 vigentes en NL sólo puede ser el parser.
      const catalogo = JSON.parse(fixture) as Record<string, unknown>[];
      const relleno = Array.from({ length: 200 }, () => ({ ...catalogo[0], abrevEstado: "JAL" }));
      await expect(correr({ json: JSON.stringify([...catalogo, ...relleno]) })).rejects.toThrow(
        /catálogo sano .* pero sólo \d+ vigentes/,
      );
    });

    it("NO revienta cuando el catálogo entero es chico (fuente legítimamente corta)", async () => {
      await expect(correr()).resolves.toHaveLength(5);
    });
  });
});

describe("resolverVersion", () => {
  it("saca la versión de la home y el chunk", async () => {
    const pedir = async (url: string) =>
      url.includes("_app-") ? new Response(APP_JS) : new Response(HOME_HTML);
    expect(await resolverVersion(pedir)).toBe("27768");
  });
});
