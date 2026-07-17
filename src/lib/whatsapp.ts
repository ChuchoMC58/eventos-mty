import twilio from "twilio";

export interface MessageSender {
  create(opts: { from: string; to: string; body: string }): Promise<unknown>;
}

function twilioSender(): MessageSender {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return { create: (o) => client.messages.create(o) };
}

// REGLA DE SEGURIDAD: el modo prueba está ACTIVO por defecto — todo mensaje va
// al número del administrador. Solo WHATSAPP_TEST_MODE="false" envía a usuarios reales.
export async function sendWhatsApp(to: string, body: string, sender?: MessageSender): Promise<void> {
  const s = sender ?? twilioSender();
  const testMode = process.env.WHATSAPP_TEST_MODE !== "false";
  const dest = testMode ? process.env.ADMIN_WHATSAPP : to;
  if (!dest) throw new Error("Falta ADMIN_WHATSAPP para el modo prueba");
  await s.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${dest}`,
    body: testMode ? `[PRUEBA → ${to}]\n${body}` : body,
  });
}
