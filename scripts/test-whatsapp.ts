import { sendPlantilla, plantillaOtp } from "../src/lib/whatsapp";

// Manda la plantilla de OTP con un código de mentiras. Con WHATSAPP_TEST_MODE
// sin apagar (el default) llega al número del admin, no al destinatario.
sendPlantilla("+520000000000", plantillaOtp("123456")).then(
  (msg) => console.log(`Enviado (${msg.sid ?? "sin sid"}) — revisa el WhatsApp del admin`),
  (err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  },
);
