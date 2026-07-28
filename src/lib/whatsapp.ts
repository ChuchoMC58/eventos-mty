import twilio from "twilio";

/** Lo que el proveedor nos dice de un mensaje. Todo opcional: los tests inyectan senders mínimos. */
export interface MessageInfo {
  sid?: string;
  status?: string;
  errorCode?: number | null;
  errorMessage?: string | null;
}

export interface MessageSender {
  create(opts: { from: string; to: string; body: string }): Promise<MessageInfo>;
  /** Relee el estado de un mensaje ya creado. Sin esto no se puede confirmar la entrega. */
  fetch?(sid: string): Promise<MessageInfo>;
}

export function twilioSender(): MessageSender {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return {
    create: (o) => client.messages.create(o),
    fetch: (sid) => client.messages(sid).fetch(),
  };
}

// REGLA DE SEGURIDAD: el modo prueba está ACTIVO por defecto — todo mensaje va
// al número del administrador. Solo WHATSAPP_TEST_MODE="false" envía a usuarios reales.
export async function sendWhatsApp(
  to: string,
  body: string,
  sender?: MessageSender,
): Promise<MessageInfo> {
  const s = sender ?? twilioSender();
  const testMode = process.env.WHATSAPP_TEST_MODE !== "false";
  const dest = testMode ? process.env.ADMIN_WHATSAPP : to;
  if (!dest) throw new Error("Falta ADMIN_WHATSAPP para el modo prueba");
  return await s.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${dest}`,
    body: testMode ? `[PRUEBA → ${to}]\n${body}` : body,
  });
}

// `create()` devuelve `queued`/`accepted` SIN lanzar excepción: el rebote real
// (p.ej. 63016, fuera de la ventana de 24 h del Sandbox) llega segundos después
// y de forma asíncrona. Por eso un envío "exitoso" no prueba nada todavía.
// `sent` NO cuenta como entregado: solo dice que Twilio se lo pasó a Meta, y de
// ahí todavía puede caer en `undelivered`. Se sigue esperando.
const ESTADOS_ENTREGADO = new Set(["delivered", "read"]);
const ESTADOS_FALLIDOS = new Set(["failed", "undelivered", "canceled"]);

export interface Entrega {
  entregado: boolean;
  /** true mientras el estado siga siendo provisional al agotar los reintentos. */
  indeciso: boolean;
  status?: string;
  error?: string;
}

const ESPERAS_MS = [2000, 3000, 5000, 8000, 12000];

/**
 * Espera a que el mensaje llegue a un estado terminal. Devuelve `indeciso` si
 * sigue en tránsito al agotar las esperas (~30 s), o si el sender no sabe releer.
 */
export async function confirmarEntrega(
  msg: MessageInfo,
  sender: MessageSender,
  esperas: number[] = ESPERAS_MS,
): Promise<Entrega> {
  let actual = msg;
  for (let i = 0; ; i++) {
    if (actual.status && ESTADOS_FALLIDOS.has(actual.status)) {
      const cod = actual.errorCode ? `${actual.errorCode}: ` : "";
      return {
        entregado: false,
        indeciso: false,
        status: actual.status,
        error: `${cod}${actual.errorMessage ?? "el proveedor rechazó el mensaje"}`,
      };
    }
    if (actual.status && ESTADOS_ENTREGADO.has(actual.status)) {
      return { entregado: true, indeciso: false, status: actual.status };
    }
    if (i >= esperas.length || !sender.fetch || !actual.sid) {
      return { entregado: false, indeciso: true, status: actual.status };
    }
    await new Promise((r) => setTimeout(r, esperas[i]));
    actual = await sender.fetch(actual.sid);
  }
}
