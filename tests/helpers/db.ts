import { prisma } from "@/lib/db";

// Limpia todas las tablas respetando llaves foráneas. Solo para tests.
export async function resetDb() {
  await prisma.savedEvent.deleteMany();
  await prisma.eventSource.deleteMany();
  await prisma.sourceRun.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.source.deleteMany();
  await prisma.user.deleteMany();
}
