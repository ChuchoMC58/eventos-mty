import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { aremaConnector, categoryFrom, mapAremaEvento, parseFicha } from "@/lib/ingest/sources/arema";

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

describe("parseFicha", () => {
  // Las fichas de abajo son recortes literales de sinopsis reales; los casos
  // raros salieron de revisar las 115 distintas que había en la BD el
  // 2026-08-14, no de imaginar formatos.
  const ficha = (bloque: string) =>
    parseFicha(
      `**Fecha:** 05 de Septiembre 2026\n**Lugar:** Auditorio Rio 70\n` +
        `**Dirección del evento:** Serafín Peña 1051, Centro, 64000 Monterrey, N.L.\n\n${bloque}\n\n` +
        `**Puntos de venta oficiales:**\n- Museo del Noreste (MUNE): Dr. José Ma. Coss 445, Centro, 64000 Monterrey, N.L.`,
    );

  it("saca el rango de la sección de precios", () => {
    const f = ficha("**Zonas y Precios:**\n• Vip: $500\n• Preferente: $400\n• Platea: $300\n(Precios más cargos por servicio)");
    expect(f).toMatchObject({ priceMin: 300, priceMax: 500 });
  });

  it("un solo precio deja priceMax vacío, para que se lea 'desde'", () => {
    expect(ficha("**Zonas y precios:**\n• General: $650")).toMatchObject({
      priceMin: 650,
      priceMax: undefined,
    });
  });

  it("no toca las cifras de fuera de la sección", () => {
    // "Puntos de venta oficiales" trae direcciones con números y códigos
    // postales; sin el corte, un "64000" cualquiera se volvería un precio.
    expect(ficha("Zonas y Precios:\nGeneral: $250")).toMatchObject({ priceMin: 250 });
  });

  it("una mesa se publica a lo que sale por cabeza, no a lo que cuesta entera", () => {
    // $2,700 por una mesa de 6 no es un evento de $2,700: es uno de $450, y
    // publicarlo entero lo sacaría de cualquier filtro de precio.
    const f = ficha(
      "**Zonas y Precios:**\n• Mesa 2px: $900 ($450 por Persona)\n• Mesa 4px: $1,800 ($450 por Persona)\n• Mesa 6px: $2,700 ($450 por Persona)",
    );
    expect(f).toMatchObject({ priceMin: 450, priceMax: undefined });
  });

  it("lo que la ficha llama 'por persona' gana sobre la división", () => {
    // "Mesa 4px: $500 (por persona)" son $500 por cabeza, no $125.
    expect(ficha("Zonas y Precios:\nMesa 4px: $500 (por persona)")).toMatchObject({ priceMin: 500 });
  });

  it("sin desglose, el cupo de la línea divide el total", () => {
    // Panzaland: el mismo boleto para 1, 2 y 4 personas.
    const f = ficha("Zonas y Precios:\nGeneral: \n• Individual: $299 (1px)\n• Dúo: $499 (2px)\n• Pá la Familia o los Cuates: $844 (4px)");
    expect(f).toMatchObject({ priceMin: 211, priceMax: 299 });
  });

  it("descarta el precio de grupo cuyo cupo no dice la ficha", () => {
    // "Palco Rojo: $2,500" en un estadio puede ser el palco entero o un asiento;
    // como no se sabe, no infla el máximo.
    const f = ficha("Zonas y precios:\nZona Tumbada: $2,750\nPalco Rojo: $2,500\nTercer Nivel Central: $750");
    expect(f).toMatchObject({ priceMin: 750, priceMax: 2750 });
  });

  it("lee la dirección, que su API no expone en ningún campo", () => {
    expect(ficha("Zonas y Precios:\nGeneral: $250").address).toBe(
      "Serafín Peña 1051, Centro, 64000 Monterrey, N.L.",
    );
    // Hay fichas que la ponen sin "del evento" y sin espacio tras los dos puntos.
    expect(parseFicha("Dirección:Junto a PARK POINT, Av Paseo de los Leones 99").address).toBe(
      "Junto a PARK POINT, Av Paseo de los Leones 99",
    );
  });

  it("una ficha en prosa sin encabezados también da precio", () => {
    // El rodeo del Montana Bull no usa la plantilla: los precios van sueltos.
    expect(parseFicha("Sáb. 19 de Sept. 2026\n\n$450 grada \n$600 silla numerada \n$1100 VIP")).toMatchObject({
      priceMin: 450,
      priceMax: 1100,
    });
  });

  it("no inventa precio ni dirección cuando la ficha no los trae", () => {
    // Sinopsis que es sólo sinopsis: 1 de las 115 reales. Un precio inventado
    // es peor que ninguno (regla 4: `undefined` es "no sé", no "gratis").
    expect(parseFicha("Dirección Leticia Parra\nTexto y actuación Pablo Luna")).toMatchObject({
      priceMin: undefined,
      priceMax: undefined,
    });
    expect(parseFicha(undefined)).toEqual({});
    expect(parseFicha("")).toEqual({});
  });

  it("ignora las cifras sin '$'", () => {
    // "General (día del evento): 1,100" es un precio, pero sin el signo no se
    // distingue de un código postal o de una hora, así que no se adivina.
    expect(parseFicha("Zonas y costos:\nPreventa: $1,000\nGeneral (día del evento): 1,100")).toMatchObject({
      priceMin: 1000,
      priceMax: undefined,
    });
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

  it("el precio y la dirección de la ficha llegan al evento", () => {
    // Son los dos únicos datos de AREMA que no viven en un campo de su API.
    const ev = mapAremaEvento(base, detalles["20420"].data, AHORA)[0];
    expect(ev.priceMin).toBe(500);
    expect(ev.priceMax).toBe(800);
    expect(ev.venue.address).toBe("C. Diego de Montemayor 927-Sur, Barrio Antiguo, Centro, 64000 Monterrey, N.L.");
  });

  it("sin ficha no hay precio ni dirección, y el evento igual se publica", () => {
    const ev = mapAremaEvento(base, null, AHORA)[0];
    expect(ev.priceMin).toBeUndefined();
    expect(ev.venue.address).toBeUndefined();
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
