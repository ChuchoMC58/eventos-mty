import { runReminders } from "../src/lib/reminders/run";
import { prisma } from "../src/lib/db";

runReminders().then(async (r) => {
  const indecisos = r.indecisos > 0 ? ` (${r.indecisos} sin confirmar entrega)` : "";
  console.log(`Recordatorios: ${r.enviados} enviados${indecisos}, ${r.fallidos} fallidos`);
  await prisma.$disconnect();
  // Salir con error hace que la Scheduled Task de Coolify marque la corrida como
  // fallida en vez de tragarse los rebotes en silencio.
  if (r.fallidos > 0) process.exitCode = 1;
});
