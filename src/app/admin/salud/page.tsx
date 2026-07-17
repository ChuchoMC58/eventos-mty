import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

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
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Salud de fuentes</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Fuente</th>
            <th className="p-2">Última corrida</th>
            <th className="p-2">Eventos</th>
            <th className="p-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const [last, prev] = s.runs;
            const caida = last && (!last.ok || ((prev?.eventCount ?? 0) >= 5 && last.eventCount === 0));
            return (
              <tr key={s.id} className="border-b">
                <td className="p-2">{s.name}</td>
                <td className="p-2">{last ? last.ranAt.toLocaleString("es-MX") : "nunca"}</td>
                <td className="p-2">{last?.eventCount ?? "—"}</td>
                <td className="p-2">
                  {!last ? "—" : caida ? `⚠ Revisar${last.error ? `: ${last.error}` : ""}` : "✓ OK"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
