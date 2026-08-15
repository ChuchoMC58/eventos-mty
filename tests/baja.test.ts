import { describe, it, expect } from "vitest";
import { esBaja } from "@/lib/whatsapp";

describe("esBaja — qué cuenta como pedir la baja", () => {
  it("acepta la palabra exacta que pide la plantilla, en cualquier caja", () => {
    // El cuerpo aprobado del digest dice "Responde BAJA", en mayúsculas.
    for (const t of ["baja", "BAJA", "Baja", "bAjA"]) {
      expect(esBaja(t), t).toBe(true);
    }
  });

  it("aguanta puntuación, espacios, acentos y emoji alrededor", () => {
    for (const t of ["Baja.", " baja ", "¡BAJA!", "baja!!", "bája", "baja 👍", "\nbaja\n"]) {
      expect(esBaja(t), t).toBe(true);
    }
  });

  it("acepta las formas largas que la gente escribe de verdad", () => {
    for (const t of [
      "darme de baja",
      "dar de baja",
      "dame de baja",
      "me doy de baja",
      "Quiero darme de baja",
      "DARME DE BAJA POR FAVOR",
      "hola baja porfa",
      "baja gracias",
      "cancelar",
      "cancelar suscripción",
      "stop",
      "STOP",
      "unsubscribe",
    ]) {
      expect(esBaja(t), t).toBe(true);
    }
  });

  it("NO da de baja a quien dice lo contrario", () => {
    // El caso que mata a un `includes`: la frase contiene "darme de baja"
    // entera y significa justo lo opuesto.
    for (const t of [
      "no quiero darme de baja",
      "no me quiero dar de baja",
      "ya no quiero darme de baja",
    ]) {
      expect(esBaja(t), t).toBe(false);
    }
  });

  it("NO da de baja con mensajes normales", () => {
    for (const t of [
      "",
      "hola",
      "gracias",
      "a qué hora es el evento",
      "me das de baja el precio?",
      "la banda tocó bajísimo",
      "bajaron los boletos?",
      "quiero ir",
    ]) {
      expect(esBaja(t), t).toBe(false);
    }
  });
});
