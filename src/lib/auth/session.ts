import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const sign = (v: string) =>
  createHmac("sha256", process.env.SESSION_SECRET!).update(v).digest("hex");

export async function createSession(userId: string): Promise<void> {
  (await cookies()).set("session", `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const raw = (await cookies()).get("session")?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const id = raw.slice(0, dot);
  if (raw.slice(dot + 1) !== sign(id)) return null;
  // La firma puede ser válida y aun así apuntar a un usuario que ya no está en la
  // BD (cuenta borrada, BD reseteada). Sin esta comprobación la app se ve "con
  // sesión" pero cada escritura truena con un error de llave foránea; tratamos la
  // sesión huérfana como si no hubiera cookie.
  const usuario = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  return usuario ? id : null;
}
