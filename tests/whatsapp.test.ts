import { describe, it, expect, beforeEach } from "vitest";
import { sendWhatsApp, MessageSender } from "@/lib/whatsapp";

function recorder() {
  const sent: Array<{ from: string; to: string; body: string }> = [];
  const sender: MessageSender = {
    create: async (o) => {
      sent.push(o);
      return {};
    },
  };
  return { sent, sender };
}

describe("sendWhatsApp", () => {
  beforeEach(() => {
    process.env.TWILIO_WHATSAPP_FROM = "+14155238886";
    process.env.ADMIN_WHATSAPP = "+528100000000";
  });

  it("en modo prueba (default) redirige TODO al admin con etiqueta", async () => {
    delete process.env.WHATSAPP_TEST_MODE;
    const { sent, sender } = recorder();
    await sendWhatsApp("+528187654321", "Hola", sender);
    expect(sent[0].to).toBe("whatsapp:+528100000000");
    expect(sent[0].body).toBe("[PRUEBA → +528187654321]\nHola");
  });

  it("con WHATSAPP_TEST_MODE=false envía al destinatario real", async () => {
    process.env.WHATSAPP_TEST_MODE = "false";
    const { sent, sender } = recorder();
    await sendWhatsApp("+528187654321", "Hola", sender);
    expect(sent[0].to).toBe("whatsapp:+528187654321");
    expect(sent[0].body).toBe("Hola");
    process.env.WHATSAPP_TEST_MODE = "true";
  });
});
