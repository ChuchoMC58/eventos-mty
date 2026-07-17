import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth/session";
import { z } from "zod";
import { CATEGORIES } from "@/lib/events/types";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 });
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return Response.json({ error: "No autenticado" }, { status: 401 });
  return Response.json({
    phone: u.phone,
    categories: u.categories,
    tags: u.tags,
    digestDay: u.digestDay,
    reminderPref: u.reminderPref,
  });
}

const PatchSchema = z.object({
  categories: z.array(z.enum(CATEGORIES)).optional(),
  tags: z.array(z.string().trim().min(1)).max(30).optional(),
  digestDay: z.number().int().min(0).max(6).nullable().optional(),
  reminderPref: z.enum(["always", "ask", "never"]).optional(),
});

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 });
  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  await prisma.user.update({ where: { id: userId }, data: parsed.data });
  return Response.json({ ok: true });
}
