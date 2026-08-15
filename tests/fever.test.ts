import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  feverConnector,
  planesEnHome,
  parsePaginaPlan,
  mapPlan,
  categoryFrom,
  PlanFever,
  Funcion,
} from "@/lib/ingest/sources/fever";

const fixture = (n: string) => readFileSync(path.join(__dirname, "fixtures", n), "utf8");

const HOME = fixture("fever-home.html");
const FUNCIONES = fixture("fever-plan-funciones.html"); // Candlelight Vivaldi (114535)
const TEMPORADA = fixture("fever-plan-temporada.html"); // El Laberinto de Tim Burton (587490)
const AGOTADO = fixture("fever-plan-agotado.html"); // La Odisea IMAX (660823)
const OTRA_CIUDAD = fixture("fever-plan-otra-ciudad.html"); // Arjona en Aguascalientes (610541)

/** 2026-08-07 06:00 en Monterrey; los fixtures cuelgan de esa fecha. */
const AHORA = new Date("2026-08-07T12:00:00.000Z");

function fakeFetch(rutas: Record<string, string | number> = {}) {
  const pedidas: string[] = [];
  const fn = (async (url: string) => {
    pedidas.push(url);
    const r = rutas[url] ?? rutas[url.replace("https://feverup.com", "")];
    if (typeof r === "number") return new Response("", { status: r });
    if (typeof r === "string") return new Response(r);
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  return { fn, pedidas };
}

/** Una página de plan mínima, para los casos que no vale la pena fixturizar. */
function paginaFalsa(planDetail: Record<string, unknown>): string {
  const estado = {
    "page-config": { planDetail: { name: "Un plan", citySlug: "monterrey", ...planDetail } },
    "ticket-selector-config": { transferState: {} },
  };
  return `<html><body><script id="astro-tools-transfer-state" type="application/json">${JSON.stringify(estado)}</script></body></html>`;
}

const RUTAS_OK = {
  "https://feverup.com/es/monterrey": HOME,
  "/m/114535": FUNCIONES,
  "/m/587490": TEMPORADA,
  "/m/610541": OTRA_CIUDAD,
};

describe("planesEnHome", () => {
  it("saca los ids de las islas de Astro, sin repetir los que salen en varios carruseles", () => {
    const planes = planesEnHome(HOME);
    expect(planes.map((p) => p.id).sort()).toEqual([114535, 549967, 587490, 610541]);
  });

  it("marca las tarjetas de regalo para no pedir su página", () => {
    // Es sólo un ahorro de peticiones: el filtro que manda es el de mapPlan.
    expect(planesEnHome(HOME).find((p) => p.id === 549967)?.isTimeless).toBe(true);
    expect(planesEnHome(HOME).find((p) => p.id === 114535)?.isTimeless).toBe(false);
  });

  it("ignora las islas que no son tarjetas de plan", () => {
    expect(planesEnHome(`<astro-island props="{&quot;class&quot;:[0,&quot;astro-x&quot;]}"></astro-island>`)).toEqual([]);
  });
});

describe("parsePaginaPlan", () => {
  it("lee el plan del transfer-state: sede con dirección, ciudad y categorías", () => {
    const plan = parsePaginaPlan(FUNCIONES, 114535)!;
    expect(plan.title).toBe("Candlelight: Las Cuatro Estaciones de Vivaldi");
    expect(plan.citySlug).toBe("monterrey");
    expect(plan.venue).toEqual({
      name: "Museo de Historia Mexicana",
      address: "Dr. José Ma. Coss 445, Centro, Monterrey, N.L., 64000",
    });
    expect(plan.esTemporada).toBe(false);
    expect(plan.categoria).toBe("nightlife");
  });

  it("desescapa la descripción (viene con \\uXXXX y etiquetas) y la recorta a un párrafo", () => {
    const desc = parsePaginaPlan(FUNCIONES, 114535)!.description!;
    expect(desc).toContain("Candlelight son los conciertos a la luz de las velas");
    expect(desc).not.toContain("\\u003C");
    expect(desc).not.toContain("<");
    expect(desc.length).toBeLessThanOrEqual(510);
  });

  // El árbol del selector es `fecha → hora → sesión` aquí, `hora → sesión` en un
  // plan de temporada y a veces sólo `sesión`: se recorre entero y se recogen
  // las hojas con `starts_at_iso`.
  it("recoge las funciones de todos los niveles del selector", () => {
    const plan = parsePaginaPlan(FUNCIONES, 114535)!;
    expect(plan.funciones).toHaveLength(4); // 2 fechas × 2 zonas
    expect(plan.funciones[0].startsAt.toISOString()).toBe("2026-09-27T01:00:00.000Z");
    expect(plan.funciones.map((f) => f.precio)).toEqual([650, 620, 600, 500]);
  });

  for (const tz of ["UTC", "America/Monterrey", "Asia/Tokyo"]) {
    it(`las horas no dependen de la TZ del proceso (TZ=${tz})`, () => {
      const original = process.env.TZ;
      process.env.TZ = tz;
      try {
        // 26 de septiembre 19:00 en Monterrey (UTC−6) = 27 a las 01:00 UTC
        expect(parsePaginaPlan(FUNCIONES, 114535)!.funciones[0].startsAt.toISOString()).toBe(
          "2026-09-27T01:00:00.000Z",
        );
        // El plan de temporada compone la fecha del calendario con una hora
        // suelta, que es el caso que de verdad puede leerse mal.
        expect(mapPlan(parsePaginaPlan(TEMPORADA, 587490)!, AHORA)[0].startsAt.toISOString()).toBe(
          "2026-08-07T21:00:00.000Z",
        );
      } finally {
        process.env.TZ = original;
      }
    });
  }

  it("tira el CSS de las descripciones que traen un <style> adentro", () => {
    // El "Super Paquete" de Papalote publicaba `* { box-sizing: border-box; } …`
    // como si fuera la descripción del evento.
    const conStyle = paginaFalsa({
      description:
        "\\u003Cstyle\\u003E* { box-sizing: border-box; }\\u003C/style\\u003E\\u003Cp\\u003EDescubre tres mundos.\\u003C/p\\u003E",
    });
    expect(parsePaginaPlan(conStyle, 1)!.description).toBe("Descubre tres mundos.");
  });

  it("devuelve null si la página no trae el transfer-state", () => {
    expect(parsePaginaPlan("<html><body>mantenimiento</body></html>", 1)).toBeNull();
  });
});

describe("categoryFrom", () => {
  it("mapea la taxonomía de Fever a la nuestra", () => {
    expect(categoryFrom({ categoria: "concert", categorias: [] })).toBe("musica");
    // Su cajón de "nightlife" es donde meten los Candlelight, no fiestas.
    expect(categoryFrom({ categoria: "nightlife", categorias: [] })).toBe("musica");
    expect(categoryFrom({ categoria: "sport", categorias: [] })).toBe("deportes");
    // "mix" es su cajón de sastre: cae en el nuestro.
    expect(categoryFrom({ categoria: "mix", categorias: [] })).toBe("cultura");
    expect(categoryFrom({ categoria: "theater", categorias: [] })).toBe("cultura");
  });

  it("cuando `category` viene vacía se apoya en la lista larga", () => {
    // 8 de los 49 planes la traen vacía, cuatro de ellos Candlelight.
    expect(categoryFrom({ categoria: "", categorias: ["Candlelight concert", "Small Gig"] })).toBe("musica");
    expect(categoryFrom({ categoria: "", categorias: ["Sports", "Activities"] })).toBe("deportes");
    expect(categoryFrom({ categoria: "", categorias: ["Art Gallery", "Exhibition"] })).toBe("cultura");
  });

  it("lo que no reconoce cae en cultura, no en música", () => {
    // Al revés que en Superboletos: aquí la música SÍ tiene etiqueta propia, así
    // que lo desconocido casi nunca es música.
    expect(categoryFrom({ categoria: "algo-nuevo", categorias: ["Lo Que Sea"] })).toBe("cultura");
  });
});

describe("mapPlan", () => {
  const plan = (extra: Partial<PlanFever> = {}): PlanFever => ({
    id: 1,
    title: "Un plan",
    citySlug: "monterrey",
    isTimeless: false,
    tipo: "standard",
    categoria: "concert",
    categorias: [],
    esTemporada: false,
    venue: { name: "Un venue" },
    funciones: [],
    calendario: [],
    ...extra,
  });
  const funcion = (iso: string, precio?: number): Funcion => ({
    startsAt: new Date(iso),
    precio,
    disponible: true,
  });

  it("un evento por función, con el precio más barato del día y el más caro como máximo", () => {
    const eventos = mapPlan(parsePaginaPlan(FUNCIONES, 114535)!, AHORA);
    expect(eventos).toHaveLength(2);
    expect(eventos[0].startsAt.toISOString()).toBe("2026-09-27T01:00:00.000Z");
    expect(eventos[0].endsAt?.toISOString()).toBe("2026-09-27T02:00:00.000Z");
    // Zona C 650 y Zona D 620 esa noche: el "desde" es 620.
    expect(eventos[0].priceMin).toBe(620);
    expect(eventos[0].priceMax).toBe(650);
    expect(eventos[0].category).toBe("musica");
    expect(eventos[0].ticketUrl).toBe("https://feverup.com/m/114535");
    expect(eventos[1].startsAt.toISOString()).toBe("2026-12-20T03:00:00.000Z");
  });

  it("las dos funciones del mismo día se mandan como un evento (el dedupe las fusionaría igual)", () => {
    const eventos = mapPlan(
      plan({ funciones: [funcion("2026-09-01T01:00:00Z", 500), funcion("2026-09-01T03:00:00Z", 900)] }),
      AHORA,
    );
    expect(eventos).toHaveLength(1);
    expect(eventos[0].startsAt.toISOString()).toBe("2026-09-01T01:00:00.000Z");
    expect(eventos[0].priceMin).toBe(500);
    expect(eventos[0].priceMax).toBe(900);
  });

  it("un solo precio no inventa un máximo", () => {
    expect(mapPlan(plan({ funciones: [funcion("2026-09-01T01:00:00Z", 500)] }), AHORA)[0].priceMax).toBeUndefined();
  });

  it("no publica funciones pasadas, pero sí la de hoy que ya empezó", () => {
    const eventos = mapPlan(
      plan({
        funciones: [
          funcion("2026-08-01T01:00:00Z"), // la semana pasada
          funcion("2026-08-07T03:00:00Z"), // hoy, 9 horas antes del corte
          funcion("2026-09-01T01:00:00Z"),
        ],
      }),
      AHORA,
    );
    expect(eventos.map((e) => e.startsAt.toISOString())).toEqual([
      "2026-08-07T03:00:00.000Z",
      "2026-09-01T01:00:00.000Z",
    ]);
  });

  describe("planes de temporada", () => {
    it("publica UNO, en el próximo día del calendario", () => {
      // El Laberinto de Tim Burton abre 10 días seguidos: publicarlos todos sería
      // repetir el mismo título 10 veces en la cartelera.
      const eventos = mapPlan(parsePaginaPlan(TEMPORADA, 587490)!, AHORA);
      expect(eventos).toHaveLength(1);
      expect(eventos[0].startsAt.toISOString()).toBe("2026-08-07T21:00:00.000Z"); // 15:00 en MTY
      expect(eventos[0].priceMin).toBe(337.5);
      expect(eventos[0].venue.name).toBe("Centro Convex");
    });

    it("se salta los días agotados", () => {
      // La Odisea IMAX tiene agotadas las dos primeras semanas; su primer día
      // real es el 22, no el de hoy.
      const eventos = mapPlan(parsePaginaPlan(AGOTADO, 660823)!, AHORA);
      expect(eventos).toHaveLength(1);
      expect(eventos[0].startsAt.toISOString().slice(0, 10)).toBe("2026-08-22");
    });

    it("sin calendario legible se queda con la primera función activa del plan", () => {
      // Degradarse a un evento es mejor que perderlo entero.
      const eventos = mapPlan(
        plan({ esTemporada: true, primeraActiva: "2026-09-10T19:00:00-06:00" }),
        AHORA,
      );
      expect(eventos).toHaveLength(1);
      expect(eventos[0].startsAt.toISOString()).toBe("2026-09-11T01:00:00.000Z");
    });

    it("un plan que corre a diario tampoco se expande, aunque Fever no lo marque como calendario", () => {
      // El "City Tour Hop On/Hop Off" sale todos los días y publicaba 10 renglones.
      const diario = [...Array(10)].map((_, i) =>
        funcion(`2026-08-${String(10 + i).padStart(2, "0")}T16:00:00Z`, 220),
      );
      expect(mapPlan(plan({ funciones: diario }), AHORA)).toHaveLength(1);
      // Pero las 3 fechas de un Candlelight sí se expanden.
      expect(mapPlan(plan({ funciones: diario.slice(0, 3) }), AHORA)).toHaveLength(3);
    });
  });

  describe("lo que no es un evento", () => {
    it("descarta las tarjetas de regalo (isTimeless)", () => {
      expect(mapPlan(plan({ isTimeless: true, funciones: [funcion("2026-09-01T01:00:00Z")] }), AHORA)).toEqual([]);
    });

    it("descarta los planes de otra ciudad colados en la home de Monterrey", () => {
      // Ricardo Arjona en Aguascalientes: la home de MTY lo lista con el nombre
      // de su estadio, y sólo el detalle dice de qué ciudad es.
      const arjona = parsePaginaPlan(OTRA_CIUDAD, 610541)!;
      expect(arjona.citySlug).toBe("aguascalientes");
      expect(mapPlan(arjona, AHORA)).toEqual([]);
    });

    it("descarta las listas de espera", () => {
      expect(mapPlan(plan({ tipo: "waitlist", funciones: [funcion("2026-09-01T01:00:00Z")] }), AHORA)).toEqual([]);
    });

    it("descarta un plan sin sede", () => {
      expect(mapPlan(plan({ venue: undefined, funciones: [funcion("2026-09-01T01:00:00Z")] }), AHORA)).toEqual([]);
    });
  });
});

describe("feverConnector", () => {
  const correr = (rutas = RUTAS_OK) => {
    const { fn, pedidas } = fakeFetch(rutas);
    return { pedidas, eventos: feverConnector(fn, () => AHORA).fetchEvents() };
  };

  it("junta las dos etapas y no pide la página de las tarjetas de regalo", async () => {
    const { pedidas, eventos } = correr();
    expect((await eventos).map((e) => e.title)).toEqual([
      "Candlelight: Las Cuatro Estaciones de Vivaldi",
      "Candlelight: Las Cuatro Estaciones de Vivaldi",
      "El Laberinto de Tim Burton Monterrey",
    ]);
    expect(pedidas).not.toContain("https://feverup.com/m/549967");
    expect(pedidas).toHaveLength(4); // la home + 3 planes, ninguno repetido
  });

  // Regla 1: la home responde 200 aunque cambie el markup, así que una fuente
  // que se apaga en silencio tiene que reventar aquí.
  it("revienta si la home ya no suelta planes", async () => {
    const { eventos } = correr({ "https://feverup.com/es/monterrey": "<html><body>hola</body></html>" });
    await expect(eventos).rejects.toThrow(/no soltó ni un plan/);
  });

  it("revienta si ningún plan se puede leer", async () => {
    const { eventos } = correr({ "https://feverup.com/es/monterrey": HOME });
    await expect(eventos).rejects.toThrow(/ninguno de los 3 planes/);
  });

  it("un plan ilegible no tumba a los demás", async () => {
    const { eventos } = correr({ ...RUTAS_OK, "/m/587490": 500 });
    expect(await eventos).toHaveLength(2);
  });

  it("revienta si la home viene sana pero casi no salen eventos", async () => {
    // El colapso parcial que `hayCaida()` no ve: 40 planes en la home y cero
    // eventos porque cambió el árbol del selector.
    const islas = [...Array(40)]
      .map(
        (_, i) =>
          `<astro-island props="{&quot;plan&quot;:[0,{&quot;id&quot;:[0,${i + 1}],&quot;isTimeless&quot;:[0,false]}]}"></astro-island>`,
      )
      .join("");
    const rutas: Record<string, string> = { "https://feverup.com/es/monterrey": `<html><body>${islas}</body></html>` };
    for (let i = 1; i <= 40; i++) rutas[`/m/${i}`] = OTRA_CIUDAD;
    const { eventos } = correr(rutas);
    await expect(eventos).rejects.toThrow(/40 planes en la home pero sólo 0 eventos/);
  });

  it("propaga un error de la home", async () => {
    const { eventos } = correr({ "https://feverup.com/es/monterrey": 503 });
    await expect(eventos).rejects.toThrow(/home HTTP 503/);
  });
});
