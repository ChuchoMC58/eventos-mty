import { requestCode } from "@/lib/auth/otp";
import { normalizeMxPhone } from "@/lib/auth/phone";

export async function POST(req: Request) {
  const { phone } = await req.json().catch(() => ({}));
  const normalized = typeof phone === "string" ? normalizeMxPhone(phone) : null;
  if (!normalized) {
    return Response.json({ error: "Número inválido; deben ser 10 dígitos." }, { status: 400 });
  }
  try {
    await requestCode(normalized);
  } catch (err) {
    // El envío por WhatsApp puede fallar (proveedor caído, límite, número no
    // alcanzable). Traducimos el error a un mensaje claro en vez de un 500 crudo.
    console.error("request-code: fallo al enviar el código", err);
    return Response.json(
      { error: "No pudimos enviar el código por WhatsApp ahora. Intenta de nuevo en un momento." },
      { status: 503 },
    );
  }
  return Response.json({ ok: true });
}
