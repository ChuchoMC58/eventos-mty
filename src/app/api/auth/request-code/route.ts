import { requestCode } from "@/lib/auth/otp";

export async function POST(req: Request) {
  const { phone } = await req.json().catch(() => ({}));
  if (typeof phone !== "string" || !/^\+\d{10,15}$/.test(phone)) {
    return Response.json({ error: "Teléfono inválido; usa formato +52..." }, { status: 400 });
  }
  await requestCode(phone);
  return Response.json({ ok: true });
}
