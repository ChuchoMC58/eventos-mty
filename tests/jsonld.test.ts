import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { extractJsonLdEvents } from "@/lib/ingest/jsonld";

const html = readFileSync(path.join(__dirname, "fixtures", "arena-jsonld.html"), "utf8");

describe("extractJsonLdEvents", () => {
  const events = () => extractJsonLdEvents(html, { category: "musica", city: "monterrey" });

  it("extrae los dos eventos e ignora lo que no es Event ni JSON válido", () => {
    expect(events()).toHaveLength(2);
  });

  it("mapea campos del MusicEvent", () => {
    const lm = events()[0];
    expect(lm.title).toBe("Luis Miguel Tour 2026");
    expect(lm.venue.name).toBe("Arena Monterrey");
    expect(lm.venue.address).toBe("Av. Madero 2500, Monterrey");
    expect(lm.priceMin).toBe(850);
    expect(lm.ticketUrl).toBe("https://boletos.example.com/lm");
    expect(lm.status).toBe("activo");
    expect(lm.startsAt.getTime()).toBe(new Date("2026-09-10T21:00:00-06:00").getTime());
  });

  it("mapea eventStatus cancelado", () => {
    expect(events()[1].status).toBe("cancelado");
  });
});
