import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salida "standalone": genera un servidor mínimo autocontenido en
  // .next/standalone, ideal para imágenes Docker pequeñas (Coolify).
  output: "standalone",
  // Solo aplica a `next dev`: sin esto, Next 16 bloquea los chunks JS cuando el
  // dev server se abre desde un origen distinto a localhost (127.0.0.1, la IP
  // del VPS o un preview *.sslip.io) → la página carga SIN JavaScript y los
  // componentes cliente (p. ej. el input de teléfono) quedan muertos.
  allowedDevOrigins: [
    "127.0.0.1",
    "187.127.254.144",
    "*.sslip.io",
    "preview.187-127-254-144.sslip.io",
    "*.187.127.254.144.sslip.io",
  ],
};

export default nextConfig;
