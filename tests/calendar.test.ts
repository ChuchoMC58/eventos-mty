import { describe, it, expect } from "vitest";
import { googleCalendarUrl, androidCalendarIntentUrl, buildIcs } from "@/lib/calendar";

const ev = {
  title: "Rayados vs Tigres",
  startsAt: new Date("2026-08-22T19:00:00Z"),
  venueName: "Estadio BBVA",
  address: "Av. Pablo Livas 2011",
};

describe("googleCalendarUrl", () => {
  it("arma la URL de render con los datos", () => {
    const url = googleCalendarUrl(ev);
    expect(url).toContain("https://calendar.google.com/calendar/render?");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain(encodeURIComponent("Rayados vs Tigres").replace(/%20/g, "+"));
    expect(url).toContain("20260822T190000Z%2F20260822T210000Z"); // fin = inicio + 2h por defecto
  });
});

describe("androidCalendarIntentUrl", () => {
  it("manda el link web de Google a la app nativa, con fallback al navegador", () => {
    const url = androidCalendarIntentUrl(ev);
    // El intent envuelve el MISMO link web (sin el "https://", que va en scheme=).
    expect(url).toMatch(/^intent:\/\/calendar\.google\.com\/calendar\/render\?/);
    expect(url).not.toContain("intent://https://");
    expect(url).toContain("#Intent;scheme=https;package=com.google.android.calendar");
    expect(url).toContain("action=android.intent.action.VIEW");
    expect(url.endsWith(";end")).toBe(true);
    // Sin la app instalada, Chrome abre el formulario web en vez de dar error.
    expect(url).toContain(`S.browser_fallback_url=${encodeURIComponent(googleCalendarUrl(ev))}`);
  });
});

describe("buildIcs", () => {
  it("genera un VEVENT válido", () => {
    const ics = buildIcs(ev);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Rayados vs Tigres");
    expect(ics).toContain("DTSTART:20260822T190000Z");
    expect(ics).toContain("LOCATION:Estadio BBVA\\, Av. Pablo Livas 2011");
    expect(ics).toContain("END:VEVENT");
  });
});
