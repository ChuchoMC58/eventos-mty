import { sendWhatsApp } from "../src/lib/whatsapp";

sendWhatsApp("+520000000000", "Prueba de eventos-mty 🎸").then(
  () => console.log("Enviado (revisa el WhatsApp del admin)"),
  (err) => {
    console.error(err);
    process.exitCode = 1;
  },
);
