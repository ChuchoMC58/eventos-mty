import { describe, it, expect } from "vitest";
import { formatCuando, formatFecha, formatPrecio, nombreCiudad } from "@/lib/format";

describe("formatFecha", () => {
  it("día, fecha y hora en español", () => {
    expect(formatFecha(new Date("2026-07-16T21:00:00"))).toBe("jue 16 jul · 9:00 pm");
  });
});

describe("formatCuando", () => {
  const cuando = (evento: string, ahora: string) =>
    formatCuando(new Date(evento), new Date(ahora));

  it("mismo día → hoy", () => {
    expect(cuando("2026-07-29T21:00:00", "2026-07-29T10:00:00")).toBe("hoy a las 9:00 pm");
  });

  it("día siguiente → mañana", () => {
    expect(cuando("2026-07-30T18:00:00", "2026-07-29T10:00:00")).toBe("mañana a las 6:00 pm");
  });

  it("más lejos → fecha con día de la semana", () => {
    expect(cuando("2026-07-31T09:00:00", "2026-07-29T23:00:00")).toBe(
      "el vie 31 jul a las 9:00 am",
    );
  });

  // El corazón del asunto: dos eventos casi a la misma distancia en horas se
  // nombran distinto, porque manda el día de calendario. Si alguien "arregla"
  // formatCuando contando horas, este par se cae.
  it("distingue por calendario, no por horas transcurridas", () => {
    expect(cuando("2026-07-30T18:00:00", "2026-07-29T10:00:00")).toContain("mañana"); // 32 h
    expect(cuando("2026-07-31T09:00:00", "2026-07-29T23:00:00")).not.toContain("mañana"); // 34 h
  });

  // Consecuencia aceptada de la regla de calendario, fijada aquí para que
  // quede claro que es una decisión y no un descuido.
  it("un evento de madrugada es 'mañana' aunque falten 2 h", () => {
    expect(cuando("2026-07-30T01:00:00", "2026-07-29T23:00:00")).toBe("mañana a la 1:00 am");
  });
});

describe("nombreCiudad", () => {
  it("la ciudad conocida sale del mapa", () => {
    expect(nombreCiudad("monterrey")).toBe("Monterrey");
  });

  it("una ciudad nueva sale presentable sin tocar el mapa", () => {
    expect(nombreCiudad("guadalajara")).toBe("Guadalajara");
  });

  it("los conectores quedan en minúscula", () => {
    expect(nombreCiudad("ciudad-de-mexico")).toBe("Ciudad de Mexico");
  });
});

describe("formatPrecio", () => {
  it("rango", () => expect(formatPrecio(300, 2500)).toBe("$300–$2,500"));
  it("solo mínimo", () => expect(formatPrecio(500, null)).toBe("desde $500"));
  it("sin precio", () => expect(formatPrecio(null, null)).toBeNull());
  // CONARTE y Luma traen entrada libre como 0: "$0" se leería como bug.
  it("gratis", () => expect(formatPrecio(0, null)).toBe("Gratis"));
  it("gratis con max 0", () => expect(formatPrecio(0, 0)).toBe("Gratis"));
  it("gratis con boletos de pago sigue siendo rango", () =>
    expect(formatPrecio(0, 500)).toBe("$0–$500"));
});
