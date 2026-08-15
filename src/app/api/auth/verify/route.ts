import { prisma } from "@/lib/db";
import { verifyCode } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { normalizeMxPhone } from "@/lib/auth/phone";
import { CATEGORIES } from "@/lib/events/types";

export async function POST(req: Request) {
  const { phone, code } = await req.json().catch(() => ({}));
  const normalized = typeof phone === "string" ? normalizeMxPhone(phone) : null;
  // El código son SIEMPRE 6 dígitos: lo que no tenga esa forma se rechaza aquí
  // y no llega a `verifyCode`, para que un pegado con espacios o de 7 dígitos
  // no queme uno de los 5 intentos del código bueno.
  if (!normalized || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (!(await verifyCode(normalized, code))) {
    return Response.json({ error: "Código incorrecto o expirado" }, { status: 401 });
  }
  const existing = await prisma.user.findUnique({ where: { phone: normalized } });
  // Un perfil nuevo nace con TODAS las categorías, no con ninguna: la lista
  // vacía no significa "todo" sino "nada" —`eventMatchesInterests` sólo dice
  // que sí cuando la categoría del evento está en la lista—, así que arrancar
  // vacío era arrancar en silencio permanente sin que nada lo delatara.
  // (Recibir de verdad el resumen necesita además un `digestDay`, que sigue
  // siendo null hasta que la persona lo elija; no se opta a nadie por defecto.)
  const user =
    existing ?? (await prisma.user.create({ data: { phone: normalized, categories: [...CATEGORIES] } }));
  await createSession(user.id);
  return Response.json({ ok: true, isNew: !existing });
}
