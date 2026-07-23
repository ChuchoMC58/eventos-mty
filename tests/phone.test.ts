import { describe, expect, it } from "vitest";
import { mxNationalDigits, normalizeMxPhone } from "@/lib/auth/phone";

describe("normalizeMxPhone", () => {
  it("10 dígitos pelones", () => expect(normalizeMxPhone("8187654321")).toBe("+528187654321"));
  it("con lada y formato", () => expect(normalizeMxPhone("+52 81 8765 4321")).toBe("+528187654321"));
  it("lada sin +", () => expect(normalizeMxPhone("528187654321")).toBe("+528187654321"));
  it("letras", () => expect(normalizeMxPhone("+52fasdf")).toBeNull());
  it("9 dígitos", () => expect(normalizeMxPhone("818765432")).toBeNull());
  it("11 dígitos", () => expect(normalizeMxPhone("81876543210")).toBeNull());
});

describe("mxNationalDigits (sanitizador del input de login)", () => {
  it("quita todo lo que no es dígito", () => expect(mxNationalDigits("8a1b8c7")).toBe("8187"));
  it("quita la lada al pegar número completo", () =>
    expect(mxNationalDigits("+52 (81) 8765-4321")).toBe("8187654321"));
  it("no recorta números sin lada", () => expect(mxNationalDigits("8187654321")).toBe("8187654321"));
});
