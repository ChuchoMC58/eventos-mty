import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { sendPlantilla, plantillaOtp, MessageSender } from "@/lib/whatsapp";

const hashCode = (code: string) =>
  createHash("sha256").update(code + process.env.SESSION_SECRET).digest("hex");

export async function requestCode(phone: string, sender?: MessageSender): Promise<void> {
  const code = String(randomInt(100000, 1000000));
  await prisma.otpCode.create({
    data: { phone, code: hashCode(code), expiresAt: new Date(Date.now() + 10 * 60_000) },
  });
  // El texto lo fija Meta (plantilla de categoría AUTHENTICATION) y no es
  // editable: llega con botón de "copiar código" y la nota de seguridad. Los
  // 10 minutos de `expiresAt` son los mismos que declara la plantilla.
  await sendPlantilla(phone, plantillaOtp(code), sender);
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
