import { describe, it, expect, beforeEach } from "vitest";
import {
  sendPlantilla,
  plantillaOtp,
  plantillaRecordatorio,
  confirmarEntrega,
  MessageInfo,
  MessageSender,
} from "@/lib/whatsapp";

/** Variables del envío. Falla claro si el mensaje salió por texto libre en vez de plantilla. */
function varsDe(m: { contentVariables?: string }): Record<string, string> {
  if (!m.contentVariables) throw new Error("el envío fue texto libre, no plantilla");
  return JSON.parse(m.contentVariables);
}

type Enviado = { from: string; to: string; contentSid?: string; contentVariables?: string; body?: string };

function recorder() {
  const sent: Enviado[] = [];
  const sender: MessageSender = {
    create: async (o) => {
      sent.push(o);
      return {};
    },
  };
  return { sent, sender };
}

describe("sendPlantilla", () => {
  beforeEach(() => {
    process.env.TWILIO_WHATSAPP_FROM = "+17347670241";
    process.env.ADMIN_WHATSAPP = "+5219223736016";
    process.env.TWILIO_CONTENT_SID_OTP = "HXotp";
    process.env.TWILIO_CONTENT_SID_RECORDATORIO = "HXrec";
  });

  it("en modo prueba (default) redirige TODO al admin", async () => {
    delete process.env.WHATSAPP_TEST_MODE;
    const { sent, sender } = recorder();
    await sendPlantilla("+528187654321", plantillaOtp("123456"), sender);
    expect(sent[0].to).toBe("whatsapp:+5219223736016");
    expect(sent[0].contentSid).toBe("HXotp");
    expect(varsDe(sent[0])).toEqual({ "1": "123456" });
  });

  it("con WHATSAPP_TEST_MODE=false envía al destinatario real", async () => {
    process.env.WHATSAPP_TEST_MODE = "false";
    const { sent, sender } = recorder();
    await sendPlantilla("+528187654321", plantillaOtp("123456"), sender);
    expect(sent[0].to).toBe("whatsapp:+5218187654321");
    process.env.WHATSAPP_TEST_MODE = "true";
  });

  // El bug que estuvo dormido todo el tiempo que el modo prueba redirigió al
  // admin (que ya traía el 1). WhatsApp NO entrega a +52 + 10 dígitos.
  it("repone el 1 de WhatsApp-MX en el destinatario", async () => {
    process.env.WHATSAPP_TEST_MODE = "false";
    const { sent, sender } = recorder();
    await sendPlantilla("+529223736016", plantillaOtp("000000"), sender);
    expect(sent[0].to).toBe("whatsapp:+5219223736016");
    process.env.WHATSAPP_TEST_MODE = "true";
  });

  it("no duplica el 1 si el número ya lo trae", async () => {
    process.env.WHATSAPP_TEST_MODE = "false";
    const { sent, sender } = recorder();
    await sendPlantilla("+5219223736016", plantillaOtp("000000"), sender);
    expect(sent[0].to).toBe("whatsapp:+5219223736016");
    process.env.WHATSAPP_TEST_MODE = "true";
  });

  it("el recordatorio manda título, lugar, fecha e id del evento", async () => {
    const { sent, sender } = recorder();
    await sendPlantilla(
      "+528187654321",
      plantillaRecordatorio("Bad Bunny", "Arena MTY", "sáb 2 ago", "evt_1"),
      sender,
    );
    expect(varsDe(sent[0])).toEqual({
      "1": "Bad Bunny",
      "2": "Arena MTY",
      "3": "sáb 2 ago",
      "4": "evt_1",
    });
  });

  // El fallback de texto libre existe SÓLO para poder probar en local mientras
  // Meta tiene bloqueada la plantilla de OTP. Los dos tests de abajo son el
  // contrato completo: en prueba se degrada, en producción se cae. Si alguien
  // extiende el fallback a producción, el segundo test lo detiene — y sin él la
  // falla aparecería como "el login anda en pruebas y no con usuarios reales".
  it("en modo prueba, sin ContentSid, manda TEXTO LIBRE en vez de tronar", async () => {
    delete process.env.TWILIO_CONTENT_SID_OTP;
    process.env.WHATSAPP_TEST_MODE = "true";
    const { sent, sender } = recorder();

    await sendPlantilla("+528187654321", plantillaOtp("123456"), sender);

    expect(sent[0].contentSid).toBeUndefined();
    expect(sent[0].body).toContain("123456");
    expect(sent[0].to).toBe("whatsapp:+5219223736016"); // sigue yendo al admin
  });

  it("en producción, sin ContentSid, TRUENA y no manda nada", async () => {
    delete process.env.TWILIO_CONTENT_SID_OTP;
    process.env.WHATSAPP_TEST_MODE = "false";
    const { sent, sender } = recorder();

    await expect(
      sendPlantilla("+528187654321", plantillaOtp("123456"), sender),
    ).rejects.toThrow(/TWILIO_CONTENT_SID_OTP/);
    expect(sent).toHaveLength(0);

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
