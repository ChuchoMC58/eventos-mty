import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { hayCaida } from "@/lib/ingest/connector";
import { connectors } from "@/lib/ingest/registry";
import { ROTULO } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function Salud({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) notFound();

  const sources = await prisma.source.findMany({
    include: { runs: { orderBy: { ranAt: "desc" }, take: 2 } },
    orderBy: { slug: "asc" },
  });

  return (
    <main className="mx-auto max-w-[960px] px-4 pt-12 sm:px-6 sm:pt-16">
      <p className={ROTULO}>Interno</p>
      <h1 className="mt-3 mb-8 font-display text-[clamp(2rem,6.5vw,3rem)] uppercase leading-[1.04] tracking-[0.11em]">
        Salud de fuentes
      </h1>
      {/* La tabla es ancha: que se desplace ella sola en vez de romper la página. */}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-y border-linea text-left">
            <th className={`${ROTULO} p-3 font-normal`}>Fuente</th>
            <th className={`${ROTULO} p-3 font-normal`}>Última corrida</th>
            <th className={`${ROTULO} p-3 font-normal`}>Eventos</th>
            <th className={`${ROTULO} p-3 font-normal`}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const [last, prev] = s.runs;
            // Mismo criterio que runIngest, incluido el umbral propio de las
            // fuentes chicas (CONARTE, Luma), que con el global no alertarían.
            const caida =
              last &&
              hayCaida({
                ok: last.ok,
                count: last.eventCount,
                prevCount: prev?.eventCount ?? 0,
                minExpected: connectors.find((c) => c.slug === s.slug)?.minExpected,
              });
            return (
              <tr key={s.id} className="border-b border-linea">
                <td className="p-3 font-bold">{s.name}</td>
                <td className="p-3 font-mono text-[0.8rem] tabular-nums text-ceniza">
                  {last ? last.ranAt.toLocaleString("es-MX") : "nunca"}
                </td>
                <td className="p-3 font-mono tabular-nums">{last?.eventCount ?? "—"}</td>
                <td className={`p-3 font-mono text-[0.8rem] ${caida ? "text-alerta" : "text-ceniza"}`}>
                  {!last ? "—" : caida ? `⚠ Revisar${last.error ? `: ${last.error}` : ""}` : "✓ OK"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </main>
  );
}
