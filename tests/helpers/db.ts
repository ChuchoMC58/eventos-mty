import { prisma } from "@/lib/db";

// Limpia todas las tablas respetando llaves foráneas. Solo para tests.
//
// CANDADO: esto borra la BD ENTERA, no solo lo que creó el test. Si `DATABASE_URL`
// no apunta a una base con sufijo `_test`, abortamos — si no, un `npm test` mal
// configurado se lleva la BD de desarrollo por delante (pasó el 2026-07-27).
// El sufijo lo pone `tests/setup-bd.ts`, que carga `vitest.bd.config.ts`.
function exigirBdDeTests() {
  const nombre = (process.env.DATABASE_URL ?? "").split("?")[0];
  if (!nombre.endsWith("_test")) {
    throw new Error(
      'resetDb() abortado: DATABASE_URL no apunta a una BD de tests (debe terminar en "_test"). ' +
        "Corre los tests de integración con: npm run test:borra-bd",
    );
  }
}

export async function resetDb() {
  exigirBdDeTests();
  await prisma.savedEvent.deleteMany();
  await prisma.eventSource.deleteMany();
  await prisma.sourceRun.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.source.deleteMany();
  await prisma.user.deleteMany();
}
