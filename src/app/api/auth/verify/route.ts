import { prisma } from "@/lib/db";
import { verifyCode } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { normalizeMxPhone } from "@/lib/auth/phone";

export async function POST(req: Request) {
  const { phone, code } = await req.json().catch(() => ({}));
  const normalized = typeof phone === "string" ? normalizeMxPhone(phone) : null;
  if (!normalized || typeof code !== "string") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (!(await verifyCode(normalized, code))) {
    return Response.json({ error: "Código incorrecto o expirado" }, { status: 401 });
  }
  const existing = await prisma.user.findUnique({ where: { phone: normalized } });
  const user = existing ?? (await prisma.user.create({ data: { phone: normalized } }));
  await createSession(user.id);
  return Response.json({ ok: true, isNew: !existing });
}
