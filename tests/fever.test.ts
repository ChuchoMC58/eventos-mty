import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  feverConnector,
  planesEnHome,
  parsePlanDetalle,
  sesionesDeApi,
  calendarioDeApi,
  esPublicable,
  mapPlan,
  categoryFrom,
  PlanFever,
  Funcion,
} from "@/lib/ingest/sources/fever";

const fixture = (n: string) => readFileSync(path.join(__dirname, "fixtures", n), "utf8");
const json = (n: string) => JSON.parse(fixture(n));

const HOME = fixture("fever-home.html");
// La etapa 2 son respuestas de la API, no HTML: el detalle por un lado y la
// disponibilidad por otro, que es distinta según cómo se venda el plan.
const FUNCIONES = json("fever-plan-funciones.json"); // Candlelight Vivaldi (114535)
const FUNCIONES_SESIONES = json("fever-plan-funciones-sesiones.json");
const TEMPORADA = json("fever-plan-temporada.json"); // El Laberinto de Tim Burton (587490)
const TEMPORADA_CALENDARIO = json("fever-plan-temporada-calendario.json");
const TEMPORADA_DIA = json("fever-plan-temporada-dia.json"); // sus funciones del 14 de agosto
const AGOTADO = json("fever-plan-agotado.json"); // La Odisea IMAX (660823)
const AGOTADO_CALENDARIO = json("fever-plan-agotado-calendario.json");
const OTRA_CIUDAD = json("fever-plan-otra-ciudad.json"); // Arjona en Aguascalientes (610541)

/** 2026-08-07 06:00 en Monterrey; los fixtures cuelgan de esa fecha. */
const AHORA = new Date("2026-08-07T12:00:00.000Z");

/** Con `AHORA`, la ventana de calendario que pide el conector. */
const VENTANA = "from=2026-08-07&to=2026-10-06";

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

const RUTAS_OK: Record<string, string | number> = {
  "https://feverup.com/es/monterrey": HOME,
  "/api/4.4/plans/114535/": fixture("fever-plan-funciones.json"),
  "/api/4.2/plans/114535/place/22981/sessions/?exclude_sessions_as_add_ons=true":
    fixture("fever-plan-funciones-sesiones.json"),
  "/api/4.4/plans/587490/": fixture("fever-plan-temporada.json"),
  [`/api/4.2/plans/587490/place/117176/availability/?${VENTANA}`]: fixture("fever-plan-temporada-calendario.json"),
  "/api/4.2/plans/587490/place/117176/sessions_for_date/2026-08-14/?exclude_sessions_as_add_ons=true":
    fixture("fever-plan-temporada-dia.json"),
  "/api/4.4/plans/610541/": fixture("fever-plan-otra-ciudad.json"),
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

describe("parsePlanDetalle", () => {
  it("lee el plan de la API: sede con dirección, ciudad y categorías", () => {
    const plan = parsePlanDetalle(FUNCIONES, 114535)!;
    expect(plan.title).toBe("Candlelight: Las Cuatro Estaciones de Vivaldi");
    expect(plan.citySlug).toBe("monterrey");
    expect(plan.venue).toEqual({
      name: "Museo de Historia Mexicana",
      address: "Dr. José Ma. Coss 445, Centro, Monterrey, N.L., 64000",
    });
    expect(plan.esTemporada).toBe(false);
    expect(plan.categoria).toBe("nightlife");
    // El recinto no es sólo un dato del evento: va en la ruta de disponibilidad.
    expect(plan.placeId).toBe(22981);
  });

  it("la portada sale del rol, no del primer elemento de la galería", () => {
    // El primero de `media_gallery` es un VÍDEO: publicarlo dejaría un .mp4 como
    // imagen del evento.
    expect(parsePlanDetalle(FUNCIONES, 114535)!.imageUrl).toMatch(/\.jpg$/);
  });

  it("limpia la descripción (viene con etiquetas HTML) y la recorta a un párrafo", () => {
    const desc = parsePlanDetalle(FUNCIONES, 114535)!.description!;
    expect(desc).toContain("Candlelight son los conciertos a la luz de las velas");
    expect(desc).not.toContain("<");
    expect(desc.length).toBeLessThanOrEqual(510);
  });

  it("tira el CSS de las descripciones que traen un <style> adentro", () => {
    // El "Super Paquete" de Papalote publicaba `* { box-sizing: border-box; } …`
    // como si fuera la descripción del evento.
    const plan = parsePlanDetalle(
      { name: "Un plan", description: "<style>* { box-sizing: border-box; }</style><p>Descubre tres mundos.</p>" },
      1,
    )!;
    expect(plan.description).toBe("Descubre tres mundos.");
  });

  it("una categoría nula no se cuela como texto", () => {
    // El Laberinto de Tim Burton trae `category: null`, no "".
    expect(parsePlanDetalle(TEMPORADA, 587490)!.categoria).toBe("");
  });

  it("devuelve null si la respuesta no es un plan", () => {
    expect(parsePlanDetalle({ detail: "Not found" }, 1)).toBeNull();
    expect(parsePlanDetalle(null, 1)).toBeNull();
  });
});

describe("sesionesDeApi", () => {
  // El árbol del selector es `fecha → hora → sesión` aquí y `hora → sesión`
  // cuando la fecha ya viene fijada: se recorre entero y se recogen las hojas
  // con `starts_at_iso`.
  it("recoge las funciones de todos los niveles del selector", () => {
    const funciones = sesionesDeApi(FUNCIONES_SESIONES);
    expect(funciones).toHaveLength(4); // 2 fechas × 2 zonas
    expect(funciones[0].startsAt.toISOString()).toBe("2026-09-27T01:00:00.000Z");
    expect(funciones[0].endsAt?.toISOString()).toBe("2026-09-27T02:00:00.000Z");
    expect(funciones.map((f) => f.precio)).toEqual([650, 620, 600, 500]);
  });

  it("lee la disponibilidad de cada sesión", () => {
    // El árbol de un día del plan de temporada trae la zona de 225 agotada a las
    // 15:00 y con lugar a las 15:30.
    const funciones = sesionesDeApi(TEMPORADA_DIA);
    expect(funciones.filter((f) => !f.disponible).map((f) => f.precio)).toEqual([225]);
  });

  it("una respuesta sin árbol no revienta", () => {
    expect(sesionesDeApi({})).toEqual([]);
    expect(sesionesDeApi(null)).toEqual([]);
  });

  for (const tz of ["UTC", "America/Monterrey", "Asia/Tokyo"]) {
    it(`las horas no dependen de la TZ del proceso (TZ=${tz})`, () => {
      const original = process.env.TZ;
      process.env.TZ = tz;
      try {
        // 26 de septiembre 19:00 en Monterrey (UTC−6) = 27 a las 01:00 UTC
        expect(sesionesDeApi(FUNCIONES_SESIONES)[0].startsAt.toISOString()).toBe("2026-09-27T01:00:00.000Z");
        // El plan de temporada compone la fecha del calendario con una hora
        // suelta, que es el caso que de verdad puede leerse mal.
        const sinFunciones = { ...parsePlanDetalle(TEMPORADA, 587490)!, calendario: calendarioDeApi(TEMPORADA_CALENDARIO) };
        expect(mapPlan(sinFunciones, AHORA)[0].startsAt.toISOString()).toBe("2026-08-14T21:00:00.000Z");
      } finally {
        process.env.TZ = original;
      }
    });
  }
});

describe("calendarioDeApi", () => {
  it("lee los días con su precio y marca sólo los agotados", () => {
    const dias = calendarioDeApi(TEMPORADA_CALENDARIO);
    expect(dias.map((d) => d.fecha)).toEqual(["2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"]);
    // "medium" y "low" son "quedan pocos", no "no hay".
    expect(dias.filter((d) => d.agotado).map((d) => d.fecha)).toEqual(["2026-08-13"]);
    expect(dias[1].precioMin).toBe(225);
  });

  it("un calendario vacío no revienta", () => {
    expect(calendarioDeApi({ dates: {} })).toEqual([]);
    expect(calendarioDeApi(null)).toEqual([]);
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
  /** El plan como lo arma el conector: detalle + funciones. */
  const vivaldi = (): PlanFever => ({
    ...parsePlanDetalle(FUNCIONES, 114535)!,
    funciones: sesionesDeApi(FUNCIONES_SESIONES),
  });

  it("un evento por función, con el precio más barato del día y el más caro como máximo", () => {
    const eventos = mapPlan(vivaldi(), AHORA);
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
    /** El plan de temporada como lo arma el conector: calendario + el día que toca. */
    const timBurton = (extra: Partial<PlanFever> = {}): PlanFever => ({
      ...parsePlanDetalle(TEMPORADA, 587490)!,
      calendario: calendarioDeApi(TEMPORADA_CALENDARIO),
      funciones: sesionesDeApi(TEMPORADA_DIA),
      ...extra,
    });

    it("publica UNO, en el próximo día abierto del calendario", () => {
      // El Laberinto de Tim Burton abre todos los días: publicarlos todos sería
      // repetir el mismo título en la cartelera.
      const eventos = mapPlan(timBurton(), AHORA);
      expect(eventos).toHaveLength(1);
      expect(eventos[0].startsAt.toISOString()).toBe("2026-08-14T21:00:00.000Z"); // 15:00 en MTY
      expect(eventos[0].venue.name).toBe("Centro Convex");
      // El "desde" del día es 225 aunque a esa hora esa zona esté agotada; el
      // 880 es la zona premium.
      expect(eventos[0].priceMin).toBe(225);
      expect(eventos[0].priceMax).toBe(880);
    });

    it("se salta los días agotados", () => {
      // La Odisea IMAX tiene agotados los dos primeros días del calendario.
      const eventos = mapPlan(
        { ...parsePlanDetalle(AGOTADO, 660823)!, calendario: calendarioDeApi(AGOTADO_CALENDARIO) },
        AHORA,
      );
      expect(eventos).toHaveLength(1);
      // 15 de agosto en Monterrey; la hora es la de la primera función activa,
      // porque este plan se armó sin pedirle las funciones del día.
      expect(eventos[0].startsAt.toISOString()).toBe("2026-08-16T01:30:00.000Z");
      expect(eventos[0].startsAt.toLocaleDateString("en-CA", { timeZone: "America/Monterrey" })).toBe("2026-08-15");
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

    it("sin las funciones del día, la hora sale de la primera función activa", () => {
      const eventos = mapPlan(timBurton({ funciones: [] }), AHORA);
      expect(eventos[0].startsAt.toISOString()).toBe("2026-08-14T21:00:00.000Z");
      expect(eventos[0].priceMin).toBe(225); // el "desde" del calendario
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
      const arjona = parsePlanDetalle(OTRA_CIUDAD, 610541)!;
      expect(arjona.citySlug).toBe("aguascalientes");
      expect(esPublicable(arjona)).toBe(false);
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
  const correr = (rutas: Record<string, string | number> = RUTAS_OK) => {
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
    expect(pedidas.some((u) => u.includes("549967"))).toBe(false);
  });

  it("a cada plan le pide la disponibilidad que le toca, y al descartado ninguna", async () => {
    const { pedidas, eventos } = correr();
    await eventos;
    const de = (id: number) => pedidas.filter((u) => u.includes(`/plans/${id}/`)).map((u) => u.split(`/plans/${id}/`)[1]);
    // Funciones sueltas: el selector entero de una vez.
    expect(de(114535)).toEqual(["", "place/22981/sessions/?exclude_sessions_as_add_ons=true"]);
    // Corrida continua: el calendario y luego SÓLO el día que se va a publicar.
    expect(de(587490)).toEqual([
      "",
      `place/117176/availability/?${VENTANA}`,
      "place/117176/sessions_for_date/2026-08-14/?exclude_sessions_as_add_ons=true",
    ]);
    // El de otra ciudad se descarta con el detalle: no se le pide nada más.
    expect(de(610541)).toEqual([""]);
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
    const { eventos } = correr({ ...RUTAS_OK, "/api/4.4/plans/587490/": 500 });
    expect(await eventos).toHaveLength(2);
  });

  it("un plan cuya disponibilidad falla tampoco tumba a los demás", async () => {
    const { eventos } = correr({
      ...RUTAS_OK,
      "/api/4.2/plans/114535/place/22981/sessions/?exclude_sessions_as_add_ons=true": 503,
    });
    expect((await eventos).map((e) => e.title)).toEqual(["El Laberinto de Tim Burton Monterrey"]);
  });

  it("revienta si la home viene sana pero casi no salen eventos", async () => {
    // El colapso parcial que `hayCaida()` no ve: 40 planes en la home y cero
    // eventos porque la API dejó de decir de qué ciudad son.
    const islas = [...Array(40)]
      .map(
        (_, i) =>
          `<astro-island props="{&quot;plan&quot;:[0,{&quot;id&quot;:[0,${i + 1}],&quot;isTimeless&quot;:[0,false]}]}"></astro-island>`,
      )
      .join("");
    const rutas: Record<string, string | number> = {
      "https://feverup.com/es/monterrey": `<html><body>${islas}</body></html>`,
    };
    for (let i = 1; i <= 40; i++) rutas[`/api/4.4/plans/${i}/`] = fixture("fever-plan-otra-ciudad.json");
    const { eventos } = correr(rutas);
    await expect(eventos).rejects.toThrow(/40 planes en la home pero sólo 0 eventos/);
  });

  it("propaga un error de la home", async () => {
    const { eventos } = correr({ "https://feverup.com/es/monterrey": 503 });
    await expect(eventos).rejects.toThrow(/home HTTP 503/);
  });
});
