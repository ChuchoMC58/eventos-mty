import { defineConfig } from "vitest/config";
import path from "path";

// Config de los tests de INTEGRACIÓN (`npm run test:borra-bd`): los que escriben
// en Postgres y llaman `resetDb()`. `setup-bd.ts` los apunta a la BD `_test`.
// Los tests puros (sin BD) viven en `vitest.config.ts` y corren con `npm test`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.db.test.ts"],
    setupFiles: ["tests/setup-bd.ts"],
    // Comparten la BD y la resetean: no correr archivos en paralelo.
    fileParallelism: false,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
