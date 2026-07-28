import { prisma } from "@/lib/db";
import { normalizeMxPhone } from "@/lib/auth/phone";

function twiml(mensaje?: string) {
  const cuerpo = mensaje ? `<Message>${mensaje}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${cuerpo}</Response>`, {
    headers: { "content-type": "text/xml" },
  });
}

// Twilio manda las respuestas del usuario como formulario a este webhook.
export async function POST(req: Request) {
  const form = await req.formData();
  const body = String(form.get("Body") ?? "").trim().toLowerCase();
  // WhatsApp entrega los móviles MX con un 1 extra (`whatsapp:+5219223736016`),
  // mientras que el login los guarda sin él (`+529223736016`). Sin normalizar,
  // el `updateMany` de abajo no empata con nadie.
  const from = normalizeMxPhone(String(form.get("From") ?? "").replace("whatsapp:", ""));
  if (body !== "baja") return twiml();

  if (!from) {
    console.error("[whatsapp/webhook] 'baja' de un From no reconocido:", form.get("From"));
    return twiml("No pudimos identificar tu número. Puedes darte de baja desde tu perfil.");
  }

  const { count } = await prisma.user.updateMany({
    where: { phone: from },
    data: { digestDay: null },
  });

  // Solo confirmamos si de verdad se dio de baja a alguien. Antes se respondía
  // "listo" siempre, así que un usuario que no empataba se quedaba tranquilo y
  // seguía recibiendo el resumen.
  if (count === 0) {
    console.warn("[whatsapp/webhook] 'baja' sin usuario que empate:", from);
    return twiml("No encontramos una cuenta con este número. Si te registraste con otro, entra a tu perfil para cambiar el resumen.");
  }

  return twiml("Listo, ya no recibirás el resumen semanal. Puedes reactivarlo cuando quieras en tu perfil.");
}
