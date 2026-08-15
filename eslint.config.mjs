import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Skills instalados por el agente (LobeHub, Tavily…): traen sus propios
    // scripts .cjs, que no son código de la app y no tienen por qué cumplir sus
    // reglas. Sin esto, `npm run lint` sale en rojo por 15 errores ajenos.
    ".claude/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
