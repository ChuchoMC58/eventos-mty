import { runReminders } from "../src/lib/reminders/run";
import { prisma } from "../src/lib/db";

runReminders().then(async (n) => {
  console.log(`Recordatorios: ${n} enviados`);
  await prisma.$disconnect();
});
