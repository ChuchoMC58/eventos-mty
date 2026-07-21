import { describe, it, expect } from "vitest";
import { formatFecha, formatPrecio } from "@/lib/format";

describe("formatFecha", () => {
  it("día, fecha y hora en español", () => {
    expect(formatFecha(new Date("2026-07-16T21:00:00"))).toBe("jue 16 jul · 9:00 pm");
  });
});

describe("formatPrecio", () => {
  it("rango", () => expect(formatPrecio(300, 2500)).toBe("$300–$2,500"));
  it("solo mínimo", () => expect(formatPrecio(500, null)).toBe("desde $500"));
  it("sin precio", () => expect(formatPrecio(null, null)).toBeNull());
});
