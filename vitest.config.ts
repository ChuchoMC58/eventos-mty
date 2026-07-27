import { defineConfig } from "vitest/config";
import path from "path";

// Config por defecto (`npm test`): SOLO tests puros, sin BD. No borran nada, así
// que son seguros de correr con el dev server o un preview arriba.
// Los que escriben en Postgres se llaman `*.db.test.ts` y corren aparte con
// `npm run test:borra-bd` (ver `vitest.bd.config.ts`).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "tests/**/*.db.test.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
