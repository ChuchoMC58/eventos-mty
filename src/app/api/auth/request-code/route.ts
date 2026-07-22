import { requestCode } from "@/lib/auth/otp";
import { normalizeMxPhone } from "@/lib/auth/phone";

export async function POST(req: Request) {
  const { phone } = await req.json().catch(() => ({}));
  const normalized = typeof phone === "string" ? normalizeMxPhone(phone) : null;
  if (!normalized) {
    return Response.json({ error: "Número inválido; deben ser 10 dígitos." }, { status: 400 });
  }
  await requestCode(normalized);
  return Response.json({ ok: true });
}
