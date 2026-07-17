import { prisma } from "@/lib/db";
import { verifyCode } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  const { phone, code } = await req.json().catch(() => ({}));
  if (typeof phone !== "string" || typeof code !== "string") {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (!(await verifyCode(phone, code))) {
    return Response.json({ error: "Código incorrecto o expirado" }, { status: 401 });
  }
  const existing = await prisma.user.findUnique({ where: { phone } });
  const user = existing ?? (await prisma.user.create({ data: { phone } }));
  await createSession(user.id);
  return Response.json({ ok: true, isNew: !existing });
}
