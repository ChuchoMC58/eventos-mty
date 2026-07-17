import { runDigest } from "../src/lib/digest/run";
import { prisma } from "../src/lib/db";

runDigest().then(async (r) => {
  console.log(`Digest: ${r.sent} enviados, ${r.skipped} sin coincidencias`);
  await prisma.$disconnect();
});
