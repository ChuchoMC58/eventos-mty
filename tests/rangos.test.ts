import { describe, it, expect } from "vitest";
import {
  MESES_ADELANTE,
  mesesDisponibles,
  nombreRango,
  rangoFechas,
  vecinos,
} from "@/lib/events/rangos";

/**
 * Los rangos se calculan en la TZ del proceso (prod: America/Monterrey), así
 * que los `now` de estas pruebas se construyen con el constructor local y no
 * con un ISO en Z: así el test dice lo mismo corra donde corra.
 */
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("mesesDisponibles", () => {
  it("da el mes en curso y los tres siguientes", () => {
    const meses = mesesDisponibles(local(2026, 8, 11));
    expect(meses).toHaveLength(MESES_ADELANTE + 1);
    expect(meses.map((m) => m.valor)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(meses.map((m) => m.etiqueta)).toEqual(["ago", "sep", "oct", "nov"]);
  });

  it("cruza el año y ahí sí dice de qué año habla", () => {
    const meses = mesesDisponibles(local(2026, 11, 20));
    expect(meses.map((m) => m.valor)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(meses.map((m) => m.etiqueta)).toEqual(["nov", "dic", "ene 27", "feb 27"]);
  });
});

describe("rangoFechas", () => {
  it("sin nada elegido: del instante actual al fin del mes de CALENDARIO", () => {
    const now = local(2026, 8, 11, 15, 30);
    const { gte, lt } = rangoFechas({}, now);
    expect(gte).toEqual(now);
    expect(lt).toEqual(local(2026, 9, 1, 0, 0));
  });

  // El bug que originó todo esto: con una ventana rodante de 30 días, el 11 de
  // agosto la cartelera de "este mes" traía eventos del 5 de septiembre.
  it("el mes en curso NO alcanza al mes siguiente", () => {
    const { lt } = rangoFechas({}, local(2026, 8, 11));
    expect(lt!.getTime()).toBeLessThan(local(2026, 9, 5).getTime());
  });

  it("una página de mes futuro va del día 1 al día 1 del siguiente", () => {
    const { gte, lt } = rangoFechas({ mes: "2026-10" }, local(2026, 8, 11));
    expect(gte).toEqual(local(2026, 10, 1, 0, 0));
    expect(lt).toEqual(local(2026, 11, 1, 0, 0));
  });

  it("la página del mes en curso arranca ahora, no el día 1", () => {
    const now = local(2026, 8, 11, 15, 30);
    expect(rangoFechas({ mes: "2026-08" }, now).gte).toEqual(now);
  });

  it("un mes fuera de la ventana o inventado cae al mes en curso", () => {
    const now = local(2026, 8, 11);
    for (const mes of ["2027-05", "1999-01", "banana", ""]) {
      expect(rangoFechas({ mes }, now).lt).toEqual(local(2026, 9, 1, 0, 0));
    }
  });

  it("buscar barre TODO el futuro, sin tope de mes", () => {
    expect(rangoFechas({ q: "camilo" }, local(2026, 8, 11)).lt).toBeUndefined();
  });

  it("pero un mes elegido a mano le gana a la búsqueda", () => {
    const { lt } = rangoFechas({ q: "camilo", mes: "2026-09" }, local(2026, 8, 11));
    expect(lt).toEqual(local(2026, 10, 1, 0, 0));
  });

  it("hoy termina a la medianoche", () => {
    const { gte, lt } = rangoFechas({ fecha: "hoy" }, local(2026, 8, 11, 15, 30));
    expect(gte).toEqual(local(2026, 8, 11, 15, 30));
    expect(lt).toEqual(new Date(2026, 7, 11, 23, 59, 59, 999));
  });

  it("entre semana, el fin es viernes→lunes", () => {
    // 2026-08-11 es martes.
    const { gte, lt } = rangoFechas({ fecha: "finde" }, local(2026, 8, 11));
    expect(gte).toEqual(local(2026, 8, 14, 0, 0));
    expect(lt).toEqual(local(2026, 8, 17, 0, 0));
  });

  it("ya metido en el fin, arranca ahora y termina ESE lunes", () => {
    // 2026-08-15 es sábado. Antes esto daba el lunes 24: nueve días de "fin".
    const now = local(2026, 8, 15, 20, 0);
    const { gte, lt } = rangoFechas({ fecha: "finde" }, now);
    expect(gte).toEqual(now);
    expect(lt).toEqual(local(2026, 8, 17, 0, 0));
  });

  it("el domingo el fin todavía es el de ese día", () => {
    // 2026-08-16 es domingo.
    const { lt } = rangoFechas({ fecha: "finde" }, local(2026, 8, 16, 11, 0));
    expect(lt).toEqual(local(2026, 8, 17, 0, 0));
  });

  it("el viernes temprano el fin es el que empieza ese día", () => {
    // 2026-08-14 es viernes.
    const now = local(2026, 8, 14, 9, 0);
    const { gte, lt } = rangoFechas({ fecha: "finde" }, now);
    expect(gte).toEqual(now);
    expect(lt).toEqual(local(2026, 8, 17, 0, 0));
  });

  // La pestaña "Este mes" ya no existe, pero los enlaces compartidos sí.
  it("el viejo ?fecha=mes sigue dando el mes en curso", () => {
    const now = local(2026, 8, 11);
    expect(rangoFechas({ fecha: "mes" }, now).lt).toEqual(local(2026, 9, 1, 0, 0));
    expect(rangoFechas({ fecha: "mes", q: "camilo" }, now).lt).toEqual(local(2026, 9, 1, 0, 0));
  });
});

describe("nombreRango", () => {
  it("nombra el mes que se está viendo", () => {
    const now = local(2026, 8, 11);
    expect(nombreRango({}, now)).toBe("en agosto");
    expect(nombreRango({ mes: "2026-10" }, now)).toBe("en octubre");
    expect(nombreRango({ fecha: "hoy" }, now)).toBe("hoy");
    expect(nombreRango({ fecha: "finde" }, now)).toBe("este fin");
    expect(nombreRango({ q: "camilo" }, now)).toBe("próximos");
  });
});

describe("vecinos", () => {
  it("el mes en curso no tiene anterior y el último no tiene siguiente", () => {
    const now = local(2026, 8, 11);
    expect(vecinos("2026-08", now).previo).toBeUndefined();
    expect(vecinos("2026-08", now).siguiente?.valor).toBe("2026-09");
    expect(vecinos("2026-11", now).previo?.valor).toBe("2026-10");
    expect(vecinos("2026-11", now).siguiente).toBeUndefined();
  });

  it("sin mes en la query se comporta como el mes en curso", () => {
    expect(vecinos(undefined, local(2026, 8, 11)).siguiente?.valor).toBe("2026-09");
  });
});
