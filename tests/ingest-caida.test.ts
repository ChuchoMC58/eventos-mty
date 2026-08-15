import { describe, it, expect } from "vitest";
import { hayCaida } from "@/lib/ingest/connector";
import { connectors } from "@/lib/ingest/registry";

describe("hayCaida", () => {
  it("una fuente que falló siempre alerta", () => {
    expect(hayCaida({ ok: false, count: 0, prevCount: 0 })).toBe(true);
  });

  it("caer a cero desde un volumen normal alerta", () => {
    expect(hayCaida({ ok: true, count: 0, prevCount: 82 })).toBe(true);
  });

  it("una fuente que nunca trajo nada no alerta", () => {
    expect(hayCaida({ ok: true, count: 0, prevCount: 0 })).toBe(false);
  });

  it("con el umbral global, una fuente chica caería en silencio", () => {
    // CONARTE ronda los 5 eventos en 3 semanas: exigir prev ≥ 5 la deja sin red.
    expect(hayCaida({ ok: true, count: 0, prevCount: 3 })).toBe(false);
    expect(hayCaida({ ok: true, count: 0, prevCount: 3, minExpected: 2 })).toBe(true);
  });
});

describe("registry", () => {
  it("los slugs son únicos (Source.slug es la llave de la fuente)", () => {
    const slugs = connectors.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("las fuentes de scraping llevan umbral propio", () => {
    for (const slug of ["conarte", "luma"]) {
      expect(connectors.find((c) => c.slug === slug)?.minExpected).toBeLessThan(5);
    }
  });
});
