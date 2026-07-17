import { runIngest } from "../src/lib/ingest/run";
import { connectors } from "../src/lib/ingest/registry";
import { prisma } from "../src/lib/db";

async function main() {
  const reports = await runIngest(connectors);
  for (const r of reports) {
    const flag = r.dropAlert ? " ⚠ REVISAR" : "";
    console.log(`${r.ok ? "✓" : "✗"} ${r.slug}: ${r.count} eventos${r.error ? ` — ${r.error}` : ""}${flag}`);
  }
  await prisma.$disconnect();
  if (reports.some((r) => r.dropAlert)) process.exitCode = 1;
}

main();
