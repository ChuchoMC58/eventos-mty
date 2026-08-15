import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  culturaUanlConnector,
  mapEvento,
  esDeNuevoLeon,
  parsePrecio,
  entradaLibreEnTexto,
  categoriaDe,
  TribeEvento,
} from "@/lib/ingest/sources/cultura-uanl";

const fixture = readFileSync(path.join(__dirname, "fixtures", "cultura-uanl.json"), "utf8");
const eventos = JSON.parse(fixture).events as TribeEvento[];
const porTitulo = (frag: string) => eventos.find((e) => (e.title ?? "").includes(frag))!;

const AHORA = new Date("2026-08-13T12:00:00Z"); // 06:00 en Monterrey, la hora del cron

function fakeFetch(respuestas: { body: string; status?: number }[]) {
  let i = 0;
  return (async () => {
    const r = respuestas[Math.min(i++, respuestas.length - 1)];
    return new Response(r.body, { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AHORA);
});
afterEach(() => vi.useRealTimers());

describe("esDeNuevoLeon", () => {
  it("acepta la provincia escrita entera y abreviada", () => {
    expect(esDeNuevoLeon({ province: "Nuevo León", country: "Mexico" })).toBe(true);
    // El Teatro de la Ciudad la escribe así, y un filtro estricto lo tiraría.
    expect(esDeNuevoLeon({ province: "N.L.", country: "Mexico" })).toBe(true);
  });

  it("cae al CP cuando la sede no trae provincia", () => {
    // La Preparatoria 2 sólo trae el CP dentro de la calle.
    expect(
      esDeNuevoLeon({
        country: "Mexico",
        city: "Monterrey",
        address: "C. Mariano Matamoros 328, Obispado, 64060 Monterrey",
      }),
    ).toBe(true);
    // Un domicilio de la Condesa (06xxx) no cuela por el mismo camino.
    expect(
      esDeNuevoLeon({
        country: "Mexico",
        city: "Ciudad de México",
        address: "Gral. Benjamín Hill 122, Hipódromo Condesa, 06170",
      }),
    ).toBe(false);
  });

  it("descarta lo de fuera del país aunque la provincia esté puesta", () => {
    expect(esDeNuevoLeon({ province: "Lisboa", country: "Portugal" })).toBe(false);
  });
});

describe("parsePrecio", () => {
  // Regla 4: `0` es un dato real (entrada libre) y vacío es "no sé".
  it("'Entrada libre' es 0 y el costo vacío es undefined", () => {
    expect(parsePrecio("Entrada libre")).toEqual({ min: 0 });
    expect(parsePrecio("")).toEqual({});
    expect(parsePrecio(undefined)).toEqual({});
  });

  it("saca los números del texto libre", () => {
    expect(parsePrecio("$120")).toEqual({ min: 120 });
    expect(parsePrecio("$150 - $1,200 MXN")).toEqual({ min: 150, max: 1200 });
  });
});

describe("entradaLibreEnTexto", () => {
  // El plugin deja `cost` vacío y lo dice en la prosa: 6 de los 7 eventos suyos
  // sin precio al 2026-08-14. Las frases son recortes literales de esos 6.
  it("reconoce la entrada libre anunciada en la descripción", () => {
    expect(entradaLibreEnTexto("Ojo Universitario. Jueves, 19:00 horas. Entrada libre. 13 de agosto")).toBe(true);
    expect(entradaLibreEnTexto("Entrada libre. Evento en colaboración con Dirección de Desarrollo Cultural")).toBe(true);
    expect(entradaLibreEnTexto("El acceso es gratuito para todo público")).toBe(true);
  });

  it("no confunde la prosa con un anuncio de entrada libre", () => {
    // `parsePrecio` acepta `libre` a secas porque `cost` es un campo corto; en
    // una descripción eso son "aire libre" y "verso libre".
    expect(entradaLibreEnTexto("Un concierto al aire libre en la explanada")).toBe(false);
    expect(entradaLibreEnTexto("Poesía en verso libre")).toBe(false);
    expect(entradaLibreEnTexto("")).toBe(false);
    expect(entradaLibreEnTexto(undefined)).toBe(false);
  });

  it("no declara gratis lo que menciona un monto", () => {
    // "La exposición es de entrada libre; el taller cuesta $200" no es un evento
    // gratis, y no le toca a esta función decidir cuál de los dos precios vale.
    expect(entradaLibreEnTexto("Entrada libre a la exposición. Taller con costo de $200")).toBe(false);
  });

  it("no pisa el costo cuando la API sí lo trae", () => {
    // `cost` manda: el texto sólo entra cuando `parsePrecio` no supo nada.
    expect(parsePrecio("$120").min).toBe(120);
  });
});

describe("categoriaDe", () => {
  it("sólo Música y Concierto salen de cultura", () => {
    expect(categoriaDe([{ name: "Música", slug: "musica" }])).toBe("musica");
    expect(categoriaDe([{ name: "Concierto", slug: "concierto" }])).toBe("musica");
    expect(categoriaDe([{ name: "Cine", slug: "cine" }])).toBe("cultura");
    expect(categoriaDe([{ name: "Exposición", slug: "exposicion" }])).toBe("cultura");
  });

  // `Academia` es la que se antoja `tecnologia`: son coloquios de facultad, no
  // meetups de industria, que es lo que esa categoría significa aquí.
  it("Academia es cultura, no tecnologia", () => {
    expect(categoriaDe([{ name: "Academia", slug: "academia" }])).toBe("cultura");
  });

  it("con varias categorías gana musica, sin depender del orden", () => {
    const cats = [
      { name: "Música", slug: "musica" },
      { name: "Especial", slug: "especial" },
    ];
    expect(categoriaDe(cats)).toBe("musica");
    expect(categoriaDe([...cats].reverse())).toBe("musica");
  });

  it("una categoría que no conocemos cae en cultura", () => {
    expect(categoriaDe([{ name: "Lo que sea", slug: "lo-que-sea" }])).toBe("cultura");
    expect(categoriaDe([])).toBe("cultura");
  });
});

describe("mapEvento", () => {
  it("mapea un evento completo", () => {
    const e = mapEvento(porTitulo("Alfonsina en concierto"), AHORA)!;
    expect(e.title).toContain("Alfonsina en concierto");
    expect(e.category).toBe("musica");
    expect(e.venue.name).toBe("Capilla Alfonsina Biblioteca Universitaria");
    // El área es metropolitana: San Nicolás va en `zone`, no en `city`.
    expect(e.venue.zone).toBe("San Nicolás de los Garza");
    expect(e.city).toBe("monterrey");
    expect(e.status).toBe("activo");
  });

  it("interpreta la hora de pared en la zona de Monterrey", () => {
    const e = mapEvento(porTitulo("Inauguración y conferencia"), new Date("2026-08-01T00:00:00Z"))!;
    // "2026-08-12 12:00:00" en Monterrey (UTC−6) = 18:00Z.
    expect(e.startsAt.toISOString()).toBe("2026-08-12T18:00:00.000Z");
  });

  it("'Entrada libre' llega como priceMin 0", () => {
    const e = mapEvento(porTitulo("Inauguración y conferencia"), new Date("2026-08-01T00:00:00Z"))!;
    expect(e.priceMin).toBe(0);
  });

  // Un taller de varias semanas se publica como UN evento cuyo fin es el de la
  // última sesión: mejor sin hora de fin que con una falsa en el ICS.
  it("descarta el fin si el evento dura más de 24 h", () => {
    const largo = porTitulo("Círculo de lectura");
    expect(largo.end_date).toBe("2026-09-23 20:00:00"); // arranca el 19 de agosto
    expect(mapEvento(largo, AHORA)!.endsAt).toBeUndefined();
  });

  it("conserva el fin de un evento normal", () => {
    const e = mapEvento(porTitulo("Nos han dado la tierra"), new Date("2026-08-01T00:00:00Z"))!;
    expect(e.endsAt).toBeInstanceOf(Date);
    expect(e.endsAt!.getTime()).toBeGreaterThan(e.startsAt.getTime());
  });

  // 🔴 Sin este filtro entrarían a la cartelera de Monterrey los eventos que la
  // universidad hace en la Ciudad de México y en Lisboa.
  it("descarta el evento de una sede de otro estado", () => {
    expect(mapEvento(porTitulo("Ciudad de México"), AHORA)).toBeNull();
  });

  it("acepta la sede sin provincia pero con CP de Nuevo León", () => {
    const e = mapEvento(porTitulo("Preparatoria 2"), AHORA)!;
    expect(e.venue.name).toBe("Preparatoria 2 de la UANL");
    expect(e.priceMin).toBe(120);
  });

  // El dedupe es sede + día + título: si esta fuente llama al mismo recinto de
  // otra forma que AREMA, el evento que traigan las dos no se fusiona nunca.
  it("renombra las dos sedes que otra fuente ya tiene con otro nombre", () => {
    const aula = mapEvento(porTitulo("Nos han dado la tierra"), new Date("2026-08-01T00:00:00Z"))!;
    expect(aula.venue.name).toBe("Aula Magna Colegio Civil");
    const teatro = mapEvento(porTitulo("ya pasó"), new Date("2026-07-01T00:00:00Z"))!;
    expect(teatro.venue.name).toBe("Teatro Universitario UANL");
  });

  it("descarta lo que ya pasó", () => {
    expect(mapEvento(porTitulo("ya pasó"), AHORA)).toBeNull();
  });

  it("descarta un evento sin sede", () => {
    const sinSede = { ...porTitulo("Alfonsina en concierto"), venue: [] };
    expect(mapEvento(sinSede, AHORA)).toBeNull();
  });
});

describe("culturaUanlConnector", () => {
  it("trae los eventos futuros de Nuevo León y descarta el resto", async () => {
    const eventos = await culturaUanlConnector(fakeFetch([{ body: fixture }])).fetchEvents();
    const titulos = eventos.map((e) => e.title);
    expect(titulos).toContain("“Alfonsina en concierto” 2026");
    // Fuera: el de la Ciudad de México y el que ya pasó.
    expect(titulos.some((t) => t.includes("Ciudad de México"))).toBe(false);
    expect(titulos.some((t) => t.includes("ya pasó"))).toBe(false);
    expect(eventos).toHaveLength(4);
  });

  it("una página de más (404) corta la paginación sin reventar", async () => {
    const lleno = JSON.stringify({
      events: Array.from({ length: 50 }, (_, i) => ({
        ...porTitulo("Alfonsina en concierto"),
        id: 1000 + i,
        url: `https://cultura.uanl.mx/actividad/x${i}/`,
      })),
    });
    const eventos = await culturaUanlConnector(
      fakeFetch([{ body: lleno }, { body: "{}", status: 404 }]),
    ).fetchEvents();
    expect(eventos).toHaveLength(50);
  });

  it("una agenda vacía NO es un error: la API responde 200 con events: []", async () => {
    const eventos = await culturaUanlConnector(
      fakeFetch([{ body: '{"events":[],"total":0}' }]),
    ).fetchEvents();
    expect(eventos).toEqual([]);
  });

  // Regla 1: "hoy no hay nada" y "ya no sé leer esto" tienen que distinguirse.
  it("revienta si la API devuelve eventos y no se puede mapear ninguno", async () => {
    const raros = JSON.stringify({ events: [{ id: 1, titulo: "cambió el nombre del campo" }] });
    await expect(culturaUanlConnector(fakeFetch([{ body: raros }])).fetchEvents()).rejects.toThrow(
      /no se pudo mapear ninguno/,
    );
  });

  it("revienta si la respuesta ya no trae `events`", async () => {
    await expect(
      culturaUanlConnector(fakeFetch([{ body: '{"data":[]}' }])).fetchEvents(),
    ).rejects.toThrow(/no trae .events./);
  });

  it("revienta si la primera página falla", async () => {
    await expect(
      culturaUanlConnector(fakeFetch([{ body: "", status: 500 }])).fetchEvents(),
    ).rejects.toThrow(/HTTP 500/);
  });
});

// El parseo NO puede depender de la zona horaria del proceso: prod corre en
// America/Monterrey y los tests y el host en UTC. Un `new Date(naive)` pasaría
// en producción y fallaría en local, que es el peor modo de fallar.
describe("zonas horarias", () => {
  for (const tz of ["UTC", "America/Monterrey", "Asia/Tokyo"]) {
    it(`da la misma hora UTC bajo TZ=${tz}`, () => {
      const previa = process.env.TZ;
      process.env.TZ = tz;
      try {
        const e = mapEvento(porTitulo("Inauguración y conferencia"), new Date("2026-08-01T00:00:00Z"))!;
        expect(e.startsAt.toISOString()).toBe("2026-08-12T18:00:00.000Z");
      } finally {
        process.env.TZ = previa;
      }
    });
  }
});
