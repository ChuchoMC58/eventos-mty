import { describe, it, expect } from "vitest";
import { googleCalendarUrl, buildIcs } from "@/lib/calendar";

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
