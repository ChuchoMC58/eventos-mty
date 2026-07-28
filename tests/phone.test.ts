import { describe, expect, it } from "vitest";
import { mxNationalDigits, normalizeMxPhone } from "@/lib/auth/phone";

describe("normalizeMxPhone", () => {
  it("10 dígitos pelones", () => expect(normalizeMxPhone("8187654321")).toBe("+528187654321"));
  it("con lada y formato", () => expect(normalizeMxPhone("+52 81 8765 4321")).toBe("+528187654321"));
  it("lada sin +", () => expect(normalizeMxPhone("528187654321")).toBe("+528187654321"));
  it("letras", () => expect(normalizeMxPhone("+52fasdf")).toBeNull());
  it("9 dígitos", () => expect(normalizeMxPhone("818765432")).toBeNull());
  it("11 dígitos", () => expect(normalizeMxPhone("81876543210")).toBeNull());
  // El formato que Twilio entrega en el `From` de WhatsApp: lada + el 1 de móvil.
  it("formato +521 de WhatsApp", () =>
    expect(normalizeMxPhone("+5219223736016")).toBe("+529223736016"));
  it("+521 sin el +", () =>
    expect(normalizeMxPhone("5219223736016")).toBe("+529223736016"));
  it("el +521 y el +52 del mismo número colapsan al mismo canónico", () =>
    expect(normalizeMxPhone("+5219223736016")).toBe(normalizeMxPhone("+529223736016")));
  // 13 dígitos que NO son 521 siguen siendo inválidos (no es un móvil MX).
  it("13 dígitos que no empiezan con 521", () =>
    expect(normalizeMxPhone("1234567890123")).toBeNull());
});

describe("mxNationalDigits (sanitizador del input de login)", () => {
  it("quita todo lo que no es dígito", () => expect(mxNationalDigits("8a1b8c7")).toBe("8187"));
  it("quita la lada al pegar número completo", () =>
    expect(mxNationalDigits("+52 (81) 8765-4321")).toBe("8187654321"));
  it("no recorta números sin lada", () => expect(mxNationalDigits("8187654321")).toBe("8187654321"));
  it("quita el 1 de móvil del formato de WhatsApp", () =>
    expect(mxNationalDigits("+5219223736016")).toBe("9223736016"));
});
