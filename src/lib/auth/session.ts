import { createHmac } from "crypto";
import { cookies } from "next/headers";

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
  return raw.slice(dot + 1) === sign(id) ? id : null;
}
