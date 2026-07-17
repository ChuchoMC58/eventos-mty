import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { sendWhatsApp, MessageSender } from "@/lib/whatsapp";

const hashCode = (code: string) =>
  createHash("sha256").update(code + process.env.SESSION_SECRET).digest("hex");

export async function requestCode(phone: string, sender?: MessageSender): Promise<void> {
  const code = String(randomInt(100000, 1000000));
  await prisma.otpCode.create({
    data: { phone, code: hashCode(code), expiresAt: new Date(Date.now() + 10 * 60_000) },
  });
  await sendWhatsApp(phone, `Tu código de acceso a Eventos MTY es ${code}. Expira en 10 minutos.`, sender);
}

export async function verifyCode(phone: string, code: string): Promise<boolean> {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= 5) return false;
  if (otp.code !== hashCode(code)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  return true;
}
