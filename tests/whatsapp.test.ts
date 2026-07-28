import { describe, it, expect, beforeEach } from "vitest";
import { sendWhatsApp, confirmarEntrega, MessageInfo, MessageSender } from "@/lib/whatsapp";

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

/** Sender que va devolviendo una secuencia de estados en cada `fetch`. */
function seguidor(estados: MessageInfo[]): MessageSender {
  let i = 0;
  return {
    create: async () => ({ sid: "SM1", status: "queued" }),
    fetch: async (sid) => ({ sid, ...estados[Math.min(i++, estados.length - 1)] }),
  };
}

describe("confirmarEntrega", () => {
  const YA = [0, 0, 0];

  it("un `queued` que termina en delivered cuenta como entregado", async () => {
    const s = seguidor([{ status: "sending" }, { status: "sent" }, { status: "delivered" }]);
    const r = await confirmarEntrega({ sid: "SM1", status: "queued" }, s, YA);
    expect(r).toEqual({ entregado: true, indeciso: false, status: "delivered" });
  });

  it("detecta el rebote asíncrono (63016) que `create` no reporta", async () => {
    const s = seguidor([
      { status: "sent" },
      { status: "failed", errorCode: 63016, errorMessage: "fuera de ventana" },
    ]);
    const r = await confirmarEntrega({ sid: "SM1", status: "queued" }, s, YA);
    expect(r.entregado).toBe(false);
    expect(r.indeciso).toBe(false);
    expect(r.error).toBe("63016: fuera de ventana");
  });

  it("`sent` no basta: sigue esperando y queda indeciso si nunca se resuelve", async () => {
    const r = await confirmarEntrega({ sid: "SM1", status: "queued" }, seguidor([{ status: "sent" }]), YA);
    expect(r).toEqual({ entregado: false, indeciso: true, status: "sent" });
  });

  it("queda indeciso si el sender no sabe releer el estado", async () => {
    const s: MessageSender = { create: async () => ({}) };
    const r = await confirmarEntrega({ sid: "SM1", status: "queued" }, s, YA);
    expect(r.indeciso).toBe(true);
  });
});
