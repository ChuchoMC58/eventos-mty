import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { requestCode, verifyCode } from "@/lib/auth/otp";
import { MessageSender } from "@/lib/whatsapp";

const PHONE = "+528187654321";

function captureCode() {
  let code = "";
  const sender: MessageSender = {
    create: async (o) => {
      code = o.body.match(/\d{6}/)![0];
      return {};
    },
  };
  return { sender, code: () => code };
}

describe("OTP", () => {
  beforeEach(async () => {
    process.env.SESSION_SECRET = "test-secret";
    process.env.ADMIN_WHATSAPP = "+520000000000";
    process.env.TWILIO_WHATSAPP_FROM = "+14155238886";
    // Sin envoltura de modo prueba, para que captureCode lea el código limpio
    // (en modo prueba el prefijo "[PRUEBA → +52...]" mete dígitos del teléfono).
    process.env.WHATSAPP_TEST_MODE = "false";
    await resetDb();
  });

  it("código correcto verifica una sola vez", async () => {
    const cap = captureCode();
    await requestCode(PHONE, cap.sender);
    expect(await verifyCode(PHONE, cap.code())).toBe(true);
    expect(await verifyCode(PHONE, cap.code())).toBe(false); // ya usado
  });

  it("código incorrecto no verifica y no guarda el código plano", async () => {
    const cap = captureCode();
    await requestCode(PHONE, cap.sender);
    expect(await verifyCode(PHONE, "000000")).toBe(false);
    const row = await prisma.otpCode.findFirstOrThrow();
    expect(row.code).not.toBe(cap.code()); // hasheado
  });

  it("se bloquea tras 5 intentos fallidos", async () => {
    const cap = captureCode();
    await requestCode(PHONE, cap.sender);
    for (let i = 0; i < 5; i++) await verifyCode(PHONE, "000000");
    expect(await verifyCode(PHONE, cap.code())).toBe(false);
  });

  it("código expirado no verifica", async () => {
    const cap = captureCode();
    await requestCode(PHONE, cap.sender);
    await prisma.otpCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await verifyCode(PHONE, cap.code())).toBe(false);
  });
});
