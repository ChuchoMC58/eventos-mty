import { prisma } from "@/lib/db";
import { normalizeMxPhone } from "@/lib/auth/phone";
import { esBaja } from "@/lib/whatsapp";

function twiml(mensaje?: string) {
  const cuerpo = mensaje ? `<Message>${mensaje}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${cuerpo}</Response>`, {
    headers: { "content-type": "text/xml" },
  });
}

// Twilio manda las respuestas del usuario como formulario a este webhook.
export async function POST(req: Request) {
  const form = await req.formData();
  const body = String(form.get("Body") ?? "");
  // WhatsApp entrega los móviles MX con un 1 extra (`whatsapp:+5219223736016`),
  // mientras que el login los guarda sin él (`+529223736016`). Sin normalizar,
  // el `updateMany` de abajo no empata con nadie.
  const from = normalizeMxPhone(String(form.get("From") ?? "").replace("whatsapp:", ""));
  if (!esBaja(body)) return twiml();

  if (!from) {
    console.error("[whatsapp/webhook] 'baja' de un From no reconocido:", form.get("From"));
    return twiml("No pudimos identificar tu número. Puedes darte de baja desde tu perfil.");
  }

  // Baja TOTAL: apaga el resumen y también los recordatorios. Antes solo tocaba
  // `digestDay`, así que quien pedía baja seguía recibiendo recordatorios — un
  // opt-out a medias, que además Meta no acepta para plantillas de marketing.
  // `digestDay` se deja intacto para que su preferencia siga ahí si reactiva.
  const { count } = await prisma.user.updateMany({
    where: { phone: from, optOutAt: null },
    data: { optOutAt: new Date() },
  });

  // Solo confirmamos si de verdad se dio de baja a alguien. Antes se respondía
  // "listo" siempre, así que un usuario que no empataba se quedaba tranquilo y
  // seguía recibiendo el resumen.
  if (count === 0) {
    // Puede ser que no exista, o que ya estuviera dado de baja: en el segundo
    // caso confirmar de nuevo es lo correcto, no mandarlo a buscar una cuenta.
    const yaBaja = await prisma.user.count({ where: { phone: from, optOutAt: { not: null } } });
    if (yaBaja > 0) return twiml("Ya estabas dado de baja: no te vamos a escribir. Puedes reactivarlo en tu perfil.");
    console.warn("[whatsapp/webhook] 'baja' sin usuario que empate:", from);
    return twiml("No encontramos una cuenta con este número. Si te registraste con otro, entra a tu perfil para cambiar tus avisos.");
  }

  return twiml("Listo, ya no te vamos a escribir por WhatsApp: ni resumen semanal ni recordatorios. Puedes reactivarlo cuando quieras en tu perfil.");
}
