import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { tigresConnector, leerConfig, mapPartido } from "@/lib/ingest/sources/tigres";

const calendario = readFileSync(path.join(__dirname, "fixtures", "tigres-calendario.html"), "utf8");
const partidos = readFileSync(path.join(__dirname, "fixtures", "tigres-partidos.json"), "utf8");

const API = "https://datagraph-api.tigrespromo.com/v1/objects/match?edition_id=6a5529977e45750002fc314d";
const TIGRES = "0a447649-1ed4-49dd-8a22-3bacb5d990b1";

function fakeFetch(porUrl: Record<string, { body: string; status?: number }>) {
  return (async (url: string) => {
    const hit = porUrl[url];
    if (!hit) return new Response("", { status: 404 });
    return new Response(hit.body, { status: hit.status ?? 200 });
  }) as unknown as typeof fetch;
}

const feliz = fakeFetch({
  "https://www.tigres.com.mx/es/tigres/calendario/": { body: calendario },
  [API]: { body: partidos },
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-13T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("leerConfig", () => {
  // 🔴 Los atributos vienen con ESPACIOS alrededor del `=` (`edition = "…"`),
  // que es lo que rompió el primer intento de leerlos. Mismo caso que las
  // etiquetas partidas de CONARTE.
  it("lee edition e id de equipo aunque haya espacios alrededor del =", () => {
    expect(leerConfig(calendario)).toEqual({
      edicion: "6a5529977e45750002fc314d",
      equipo: TIGRES,
    });
  });

  it("devuelve null si el componente ya no está", () => {
    expect(leerConfig("<html><body>otra cosa</body></html>")).toBeNull();
  });
});

describe("mapPartido", () => {
  const ahora = new Date("2026-08-13T12:00:00Z");
  const local = {
    start: "2026-08-22T01:00:00+00:00",
    matchday_id: "5",
    status: { name: "Not Started" },
    home: { id: TIGRES, name: "Tigres" },
    visitor: { id: "otro", name: "Atlante" },
  };

  it("mapea un partido de local", () => {
    const e = mapPartido(local, TIGRES, ahora)!;
    expect(e.title).toBe("Tigres vs Atlante — Jornada 5");
    expect(e.category).toBe("deportes");
    expect(e.venue.name).toBe("Estadio Universitario");
    expect(e.startsAt.toISOString()).toBe("2026-08-22T01:00:00.000Z");
    // No trae precio y el checkout es de Boletomóvil: undefined es "no sé", que
    // no es 0 (regla 4).
    expect(e.priceMin).toBeUndefined();
  });

  it("descarta los de visita: no se juegan en Monterrey", () => {
    const visita = { ...local, home: { id: "otro", name: "Atlante" }, visitor: { id: TIGRES, name: "Tigres" } };
    expect(mapPartido(visita, TIGRES, ahora)).toBeNull();
  });

  it("descarta los ya jugados", () => {
    expect(mapPartido({ ...local, start: "2026-07-26T03:00:00+00:00" }, TIGRES, ahora)).toBeNull();
  });

  // Las fechas de esta API traen offset, así que NO necesitan fechaZonaAUtc. El
  // test lo fija para que nadie lo "arregle" con un parseo naive, que pasaría en
  // prod (America/Monterrey) y fallaría en local.
  for (const tz of ["UTC", "America/Monterrey", "Asia/Tokyo"]) {
    it(`el instante no depende de la TZ del proceso (TZ=${tz})`, () => {
      const previa = process.env.TZ;
      process.env.TZ = tz;
      try {
        expect(mapPartido(local, TIGRES, ahora)!.startsAt.toISOString()).toBe("2026-08-22T01:00:00.000Z");
      } finally {
        process.env.TZ = previa;
      }
    });
  }
});

describe("tigresConnector", () => {
  it("trae sólo los partidos de local que faltan por jugarse", async () => {
    const events = await tigresConnector(feliz).fetchEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.title.startsWith("Tigres vs"))).toBe(true);
    expect(events.every((e) => e.startsAt > new Date("2026-08-13T12:00:00Z"))).toBe(true);
    expect(events.every((e) => e.venue.name === "Estadio Universitario")).toBe(true);
  });

  // 🔴 La página se queda apuntando a un torneo VENCIDO — la del femenil lo
  // estaba el 2026-08-13. Sin esto, en enero el varonil daría cero partidos y
  // eso es indistinguible de "todavía no publican el calendario" (regla 1).
  it("revienta si el calendario apunta a una edición ya terminada", async () => {
    const viejos = JSON.parse(partidos);
    viejos[0].edition = { name: "2026 Liga MX Femenil - 1 Clausura", end_date: "2026-06-30 04:00:00" };
    const fn = fakeFetch({
      "https://www.tigres.com.mx/es/tigres/calendario/": { body: calendario },
      [API]: { body: JSON.stringify(viejos) },
    });
    await expect(tigresConnector(fn).fetchEvents()).rejects.toThrow(/terminó el/);
  });

  it("revienta si el id del equipo dejó de coincidir", async () => {
    const ajenos = JSON.parse(partidos).map((p: { home: { id: string }; visitor: { id: string } }) => ({
      ...p,
      home: { ...p.home, id: "nuevo-id" },
      visitor: { ...p.visitor, id: "otro-id" },
    }));
    ajenos[0].edition = { name: "2026 Liga Mx - 2 Apertura", end_date: "2027-01-01 05:06:16" };
    const fn = fakeFetch({
      "https://www.tigres.com.mx/es/tigres/calendario/": { body: calendario },
      [API]: { body: JSON.stringify(ajenos) },
    });
    await expect(tigresConnector(fn).fetchEvents()).rejects.toThrow(/ya no coincide/);
  });

  it("revienta si el componente del calendario cambió", async () => {
    const fn = fakeFetch({
      "https://www.tigres.com.mx/es/tigres/calendario/": { body: "<html>sin componente</html>" },
    });
    await expect(tigresConnector(fn).fetchEvents()).rejects.toThrow(/edition\/id-team/);
  });

  it("revienta si la API no devuelve partidos", async () => {
    const fn = fakeFetch({
      "https://www.tigres.com.mx/es/tigres/calendario/": { body: calendario },
      [API]: { body: "[]" },
    });
    await expect(tigresConnector(fn).fetchEvents()).rejects.toThrow(/no devolvió partidos/);
  });
});
