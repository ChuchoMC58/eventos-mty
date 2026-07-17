import { describe, it, expect } from "vitest";
import { eventMatchesInterests } from "@/lib/digest/match";

const concierto = { category: "musica", tags: ["rock"] };
const clasico = { category: "deportes", tags: ["soccer", "rayados", "tigres"] };

describe("eventMatchesInterests", () => {
  it("cruza por categoría", () => {
    expect(eventMatchesInterests(concierto, { categories: ["musica"], tags: [] })).toBe(true);
  });
  it("cruza por etiqueta aunque la categoría no esté elegida", () => {
    expect(eventMatchesInterests(clasico, { categories: ["musica"], tags: ["Rayados"] })).toBe(true);
  });
  it("no cruza sin coincidencias", () => {
    expect(eventMatchesInterests(clasico, { categories: ["cultura"], tags: ["jazz"] })).toBe(false);
  });
  it("usuario sin intereses no cruza con nada", () => {
    expect(eventMatchesInterests(concierto, { categories: [], tags: [] })).toBe(false);
  });
});
