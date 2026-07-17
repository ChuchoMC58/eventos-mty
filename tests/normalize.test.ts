import { describe, it, expect } from "vitest";
import { normalizeTitle, sameEventTitle } from "@/lib/events/normalize";

describe("normalizeTitle", () => {
  it("quita acentos, signos y mayúsculas", () => {
    expect(normalizeTitle("¡Luis Miguel: Tour 2026!")).toBe("luis miguel tour 2026");
  });
  it("colapsa espacios", () => {
    expect(normalizeTitle("  Rayados   vs  Tigres ")).toBe("rayados vs tigres");
  });
});

describe("sameEventTitle", () => {
  it("iguales tras normalizar", () => {
    expect(sameEventTitle("LUIS MIGUEL", "Luis Miguel")).toBe(true);
  });
  it("uno contiene al otro (variantes de boletera vs venue)", () => {
    expect(sameEventTitle("Luis Miguel Tour 2026", "Luis Miguel")).toBe(true);
  });
  it("distintos", () => {
    expect(sameEventTitle("Luis Miguel", "Rayados vs Tigres")).toBe(false);
  });
});
