import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { POST } from "@/app/api/whatsapp/webhook/route";

// El número tal como lo guarda el login (canónico, SIN el 1 de móvil)…
const GUARDADO = "+529223736016";
// …y tal como Twilio lo entrega en el `From` de un mensaje entrante (CON el 1).
const ENTRANTE = "whatsapp:+5219223736016";

async function mandar(body: string, from: string) {
  const form = new FormData();
  form.set("Body", body);
  form.set("From", from);
  const res = await POST(new Request("http://localhost/api/whatsapp/webhook", { method: "POST", body: form }));
  return { status: res.status, xml: await res.text() };
}

async function crearUsuario(digestDay: number | null = 1) {
  await prisma.user.create({ data: { phone: GUARDADO, digestDay } });
}

describe("webhook de WhatsApp — 'baja'", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("da de baja aunque el From venga en formato +521", async () => {
    await crearUsuario(1);
    const { xml } = await mandar("baja", ENTRANTE);

    const user = await prisma.user.findUnique({ where: { phone: GUARDADO } });
    expect(user!.optOutAt).not.toBeNull();
    expect(xml).toContain("ni resumen semanal ni recordatorios");
  });

  it("NO confirma si no empató con ningún usuario", async () => {
    // Nadie en la BD: antes respondía "listo" igual y el usuario se quedaba
    // tranquilo creyendo que se había dado de baja.
    const { xml } = await mandar("baja", ENTRANTE);

    expect(xml).not.toContain("ni resumen semanal ni recordatorios");
    expect(xml).toContain("No encontramos una cuenta");
  });

  it("sigue funcionando con un From sin el 1", async () => {
    await crearUsuario(1);
    const { xml } = await mandar("baja", `whatsapp:${GUARDADO}`);

    const user = await prisma.user.findUnique({ where: { phone: GUARDADO } });
    expect(user!.optOutAt).not.toBeNull();
    expect(xml).toContain("ni resumen semanal ni recordatorios");
  });

  it("ignora cualquier otro mensaje sin tocar al usuario", async () => {
    await crearUsuario(1);
    const { xml } = await mandar("hola", ENTRANTE);

    const user = await prisma.user.findUnique({ where: { phone: GUARDADO } });
    expect(user!.optOutAt).toBeNull();
    expect(user!.digestDay).toBe(1);
    expect(xml).not.toContain("<Message>");
  });

  // La plantilla del digest pide "Responde BAJA" y la gente contesta como
  // habla. El detalle de qué frases entran vive en `tests/baja.test.ts`; aquí
  // sólo se comprueba que el webhook use ese criterio y no una igualdad exacta.
  it("da de baja con una variante, no sólo con la palabra exacta", async () => {
    await crearUsuario(1);
    const { xml } = await mandar("BAJA por favor", ENTRANTE);

    const user = await prisma.user.findUnique({ where: { phone: GUARDADO } });
    expect(user!.optOutAt).not.toBeNull();
    expect(xml).toContain("ni resumen semanal ni recordatorios");
  });

  it("responde 200 a un From basura, sin reventar", async () => {
    const { status, xml } = await mandar("baja", "whatsapp:+1555");

    expect(status).toBe(200);
    expect(xml).toContain("No pudimos identificar tu número");
  });

  // La preferencia del resumen se conserva: darse de baja no debe borrar el día
  // elegido, para que reactivar desde el perfil lo devuelva como estaba.
  it("no pisa el digestDay al dar de baja", async () => {
    await crearUsuario(3);
    await mandar("baja", ENTRANTE);

    const user = await prisma.user.findUnique({ where: { phone: GUARDADO } });
    expect(user!.digestDay).toBe(3);
  });

  // Repetir "baja" es lo más natural del mundo si el usuario no confía; no debe
  // mandarlo a buscar una cuenta que sí existe.
  it("confirma de nuevo si ya estaba dado de baja, sin mover la fecha", async () => {
    await crearUsuario(1);
    await mandar("baja", ENTRANTE);
    const primera = (await prisma.user.findUnique({ where: { phone: GUARDADO } }))!.optOutAt;

    const { xml } = await mandar("baja", ENTRANTE);

    expect(xml).toContain("Ya estabas dado de baja");
    expect(xml).not.toContain("No encontramos una cuenta");
    const segunda = (await prisma.user.findUnique({ where: { phone: GUARDADO } }))!.optOutAt;
    expect(segunda).toEqual(primera);
  });
});
