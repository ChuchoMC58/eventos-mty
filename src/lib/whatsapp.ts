import twilio from "twilio";
import { mxWhatsAppNumber } from "@/lib/auth/phone";

/** Lo que el proveedor nos dice de un mensaje. Todo opcional: los tests inyectan senders mínimos. */
export interface MessageInfo {
  sid?: string;
  status?: string;
  errorCode?: number | null;
  errorMessage?: string | null;
}

export interface MessageSender {
  create(opts: {
    from: string;
    to: string;
    contentSid?: string;
    /** JSON con las variables de la plantilla: `{"1":"...","2":"..."}`. */
    contentVariables?: string;
    /** Texto plano. SOLO lo usa el fallback de modo prueba; ver `sendPlantilla`. */
    body?: string;
  }): Promise<MessageInfo>;
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

/**
 * Una plantilla de Meta con sus variables resueltas.
 *
 * Guarda el NOMBRE de la env var, no el ContentSid: el SID se resuelve al
 * enviar. Antes se resolvía aquí y `contentSid()` lanzaba si faltaba, así que
 * construir la plantilla ya tronaba y `sendPlantilla` nunca llegaba a decidir
 * nada — que es lo que dejó el login imposible de probar en local.
 */
export interface Plantilla {
  /** Env var con el ContentSid, p.ej. `TWILIO_CONTENT_SID_OTP`. */
  envSid: string;
  variables: Record<string, string>;
  /**
   * El mismo mensaje en texto plano. **Sólo** lo usa el fallback de modo
   * prueba; en producción no se envía nunca. No pretende ser idéntico al
   * cuerpo aprobado (ése lo fija Meta): sirve para probar el flujo.
   */
  textoPrueba: string;
}

const baseUrl = () => process.env.BASE_URL ?? "https://vibramx.fun";

/**
 * Deja el mensaje comparable: sin acentos, sin puntuación ni emoji, en
 * minúsculas y con los espacios colapsados. `"¡BAJA!"` y `"bája ."` acaban los
 * dos en `"baja"`.
 */
function normalizarMensaje(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marcas de acento que suelta NFD
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cortesías y saludos que envuelven la petición sin cambiarla. */
const RELLENO =
  /^(hola|holaa+|buenas|buen dia|buenas tardes|buenas noches|por favor|porfa|porfavor|please)\s+|\s+(por favor|porfa|porfavor|gracias|please)$/;

/**
 * Las formas que aceptamos como baja. Se compara el mensaje COMPLETO, no por
 * substring: `"no quiero darme de baja"` contiene "darme de baja" y dice justo
 * lo contrario — con un `includes` lo daríamos de baja igual.
 */
const FRASES_BAJA = new Set([
  "baja",
  "de baja",
  "la baja",
  "dar de baja",
  "darme de baja",
  "darse de baja",
  "dame de baja",
  "me doy de baja",
  "quiero darme de baja",
  "quiero dar de baja",
  "quiero la baja",
  "cancelar",
  "cancelar suscripcion",
  "cancelar la suscripcion",
  "stop",
  "unsubscribe",
]);

/**
 * ¿El usuario está pidiendo la baja?
 *
 * El cuerpo aprobado del digest dice "Responde BAJA", así que como mínimo hay
 * que aguantar mayúsculas — pero nadie escribe exactamente lo que se le pide:
 * llegan "Baja.", "darme de baja", "BAJA por favor". Antes el webhook comparaba
 * `body === "baja"` y todo eso caía en el silencio de `<Response/>`, que para
 * Meta es un opt-out que no funciona.
 */
export function esBaja(texto: string): boolean {
  let limpio = normalizarMensaje(texto);
  // En bucle porque puede venir envuelto por los dos lados: "hola baja porfa".
  let previo = "";
  while (limpio !== previo) {
    previo = limpio;
    limpio = limpio.replace(RELLENO, "").trim();
  }
  return FRASES_BAJA.has(limpio);
}

/** "1 evento" / "7 eventos" — el cuerpo aprobado no puede pluralizar. */
const cuentaEventos = (n: number) => `${n} ${n === 1 ? "evento" : "eventos"}`;

// Las tres plantillas de la app. Los ContentSid viven en variables de entorno
// porque cambian entre cuentas de Twilio; los valores de producción están en
// AGENTS.md § "el push está bloqueado" y HANDOFF.md.
export const plantillaOtp = (codigo: string): Plantilla => ({
  envSid: "TWILIO_CONTENT_SID_OTP",
  variables: { "1": codigo },
  textoPrueba: `Tu código de acceso a Vibra MX es ${codigo}. Expira en 10 minutos.`,
});

/**
 * Ojo con el ORDEN: los cuatro son `string`, así que cruzarlos compila sin
 * quejarse y sólo se nota en el WhatsApp del usuario. El orden sigue al de las
 * variables de la plantilla aprobada: {{1}} título, {{2}} cuándo, {{3}} dónde,
 * {{4}} id del evento (que va en la URL del botón, no en el cuerpo).
 *
 * `cuando` viene de `formatCuando`, no de `formatFecha`: la plantilla ya no
 * dice "Mañana es …" en texto fijo, la palabra hoy/mañana viaja en la variable.
 */
export const plantillaRecordatorio = (
  titulo: string,
  cuando: string,
  lugar: string,
  eventId: string,
): Plantilla => ({
  envSid: "TWILIO_CONTENT_SID_RECORDATORIO",
  variables: { "1": titulo, "2": cuando, "3": lugar, "4": eventId },
  textoPrueba:
    `Recordatorio de tu evento guardado 📅\n\n"${titulo}"\n` +
    `Cuándo: ${cuando}\nDónde: ${lugar}\n\n${baseUrl()}/eventos/${eventId}`,
});

/**
 * `{{1}}` lleva la cuenta CON su sustantivo ("1 evento" / "7 eventos") en vez de
 * sólo el número: el cuerpo aprobado por Meta es fijo, así que un "eventos" en
 * plural escrito ahí decía "hay 1 eventos" cada vez que alguien tenía una sola
 * coincidencia — que no es un caso raro. Por lo mismo la frase de la plantilla
 * no lleva ningún verbo que concuerde con la cuenta.
 *
 * `{{2}}` es la ciudad ya presentable (`nombreCiudad`), no el slug de la BD.
 */
export const plantillaDigest = (cuantos: number, ciudad: string): Plantilla => ({
  envSid: "TWILIO_CONTENT_SID_DIGEST",
  variables: { "1": cuentaEventos(cuantos), "2": ciudad },
  textoPrueba:
    `¡Hola! 👋 En los próximos días hay ${cuentaEventos(cuantos)} en ${ciudad} ` +
    `para ti, según tus gustos.\n\n${baseUrl()}`,
});

// Fuera del Sandbox, todo mensaje que INICIA el negocio tiene que ser una
// plantilla aprobada: el texto libre solo se permite dentro de la ventana de
// 24 h posterior a un mensaje del usuario (eso es el webhook de "baja", que
// responde con TwiML y no pasa por aquí).
//
// REGLA DE SEGURIDAD: el modo prueba está ACTIVO por defecto — todo mensaje va
// al número del administrador. Solo WHATSAPP_TEST_MODE="false" envía a usuarios reales.
//
// Ojo: el modo prueba ya NO puede anteponer "[PRUEBA → +52…]" al texto, porque
// el cuerpo de una plantilla es fijo y lo aprueba Meta. El destinatario real se
// registra en consola en su lugar.
//
// FALLBACK DE TEXTO LIBRE (sólo modo prueba). Si la plantilla no está
// configurada y estamos en modo prueba, se manda `textoPrueba` en texto plano.
// Existe porque Meta bloquea las plantillas AUTHENTICATION hasta que el negocio
// esté verificado, y sin esto el login era imposible de probar en local: se
// quedaba sin la única vía que servía. Dentro de la ventana de 24 h que abre el
// usuario al escribirle al número, el texto libre sí se entrega — la restricción
// de Meta muerde con usuarios reales, que nunca tienen esa ventana abierta.
//
// En producción NO se cae a texto libre: se lanza. Un fallback silencioso ahí
// convertiría "el login no funciona" en "funciona en pruebas y falla con
// usuarios reales", que es mucho más caro de diagnosticar.
export async function sendPlantilla(
  to: string,
  plantilla: Plantilla,
  sender?: MessageSender,
): Promise<MessageInfo> {
  const s = sender ?? twilioSender();
  const testMode = process.env.WHATSAPP_TEST_MODE !== "false";
  const dest = testMode ? process.env.ADMIN_WHATSAPP : to;
  if (!dest) throw new Error("Falta ADMIN_WHATSAPP para el modo prueba");
  const sid = process.env[plantilla.envSid];
  if (!sid && !testMode) {
    throw new Error(`Falta ${plantilla.envSid}: es el ContentSid de una plantilla aprobada`);
  }
  const comun = {
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${mxWhatsAppNumber(dest)}`,
  };
  if (testMode) console.log(`[PRUEBA] ${sid ?? plantilla.envSid} iba para ${to}`);
  if (!sid) {
    console.warn(
      `[PRUEBA] ${plantilla.envSid} no está configurada: va como TEXTO LIBRE. ` +
        `Sólo se entrega dentro de la ventana de 24 h y NO es lo que verá un ` +
        `usuario real; no lo tomes como prueba de que la plantilla funciona.`,
    );
    return await s.create({ ...comun, body: plantilla.textoPrueba });
  }
  return await s.create({
    ...comun,
    contentSid: sid,
    contentVariables: JSON.stringify(plantilla.variables),
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
