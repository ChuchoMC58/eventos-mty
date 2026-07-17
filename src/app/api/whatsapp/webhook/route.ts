import { prisma } from "@/lib/db";

// Twilio manda las respuestas del usuario como formulario a este webhook.
export async function POST(req: Request) {
  const form = await req.formData();
  const body = String(form.get("Body") ?? "").trim().toLowerCase();
  const from = String(form.get("From") ?? "").replace("whatsapp:", "");
  if (body === "baja") {
    await prisma.user.updateMany({ where: { phone: from }, data: { digestDay: null } });
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Listo, ya no recibirás el resumen semanal. Puedes reactivarlo cuando quieras en tu perfil.</Message></Response>`,
      { headers: { "content-type": "text/xml" } },
    );
  }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response/>`, {
    headers: { "content-type": "text/xml" },
  });
}
