import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salida "standalone": genera un servidor mínimo autocontenido en
  // .next/standalone, ideal para imágenes Docker pequeñas (Coolify).
  output: "standalone",
};

export default nextConfig;
