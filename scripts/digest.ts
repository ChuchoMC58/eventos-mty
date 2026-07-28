import { runDigest } from "../src/lib/digest/run";
import { prisma } from "../src/lib/db";

runDigest().then(async (r) => {
  console.log(`Digest: ${r.sent} enviados, ${r.skipped} sin coincidencias, ${r.failed} fallidos`);
  await prisma.$disconnect();
  if (r.failed > 0) process.exitCode = 1;
});
