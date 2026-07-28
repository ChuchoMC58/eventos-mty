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
    expect(user!.digestDay).toBeNull();
    expect(xml).toContain("ya no recibirás el resumen semanal");
  });

  it("NO confirma si no empató con ningún usuario", async () => {
    // Nadie en la BD: antes respondía "listo" igual y el usuario se quedaba
    // tranquilo creyendo que se había dado de baja.
    const { xml } = await mandar("baja", ENTRANTE);

    expect(xml).not.toContain("ya no recibirás el resumen semanal");
    expect(xml).toContain("No encontramos una cuenta");
  });

  it("sigue funcionando con un From sin el 1", async () => {
    await crearUsuario(1);
    const { xml } = await mandar("baja", `whatsapp:${GUARDADO}`);

    const user = await prisma.user.findUnique({ where: { phone: GUARDADO } });
    expect(user!.digestDay).toBeNull();
    expect(xml).toContain("ya no recibirás el resumen semanal");
  });

  it("ignora cualquier otro mensaje sin tocar al usuario", async () => {
    await crearUsuario(1);
    const { xml } = await mandar("hola", ENTRANTE);

    const user = await prisma.user.findUnique({ where: { phone: GUARDADO } });
    expect(user!.digestDay).toBe(1);
    expect(xml).not.toContain("<Message>");
  });

  it("responde 200 a un From basura, sin reventar", async () => {
    const { status, xml } = await mandar("baja", "whatsapp:+1555");

    expect(status).toBe(200);
    expect(xml).toContain("No pudimos identificar tu número");
  });
});
