// Setup de los tests de integración (`npm run test:borra-bd`).
//
// Estos tests RESETEAN la base entera, así que jamás deben correr contra la BD de
// desarrollo. Aquí redirigimos `DATABASE_URL` a una base desechable con sufijo
// `_test` ANTES de que se importe `@/lib/db` (que instancia Prisma al cargarse).
// El candado de `resetDb()` verifica lo mismo por si alguien salta este setup.

const SUFIJO = "_test";

// La URL puede traer query params (?schema=public); el sufijo va en el nombre de
// la base, no al final de la cadena.
export function urlDeTests(url: string): string {
  const [antes, query] = url.split("?");
  if (antes.endsWith(SUFIJO)) return url;
  return `${antes}${SUFIJO}${query ? `?${query}` : ""}`;
}

// Quien normalmente carga el `.env` es Prisma al instanciarse — o sea, DESPUÉS de
// este setup. Lo cargamos aquí para poder reescribir la URL a tiempo.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(); // Node ≥20.12: lee el .env de la raíz
  } catch {
    // sin .env: se espera DATABASE_URL en el entorno
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL para los tests de integración.");
process.env.DATABASE_URL = urlDeTests(url);
