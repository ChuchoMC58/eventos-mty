import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth/session";
import { formatFecha } from "@/lib/format";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function MisEventos() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/entrar?next=/mis-eventos");
  const saved = await prisma.savedEvent.findMany({
    where: { userId },
    include: { event: { include: { venue: true } } },
    orderBy: { event: { startsAt: "asc" } },
  });

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Mis eventos</h1>
      {saved.length === 0 && (
        <p>
          Aún no guardas eventos. <Link href="/" className="underline">Explora la cartelera</Link>.
        </p>
      )}
      <ul className="space-y-3">
        {saved.map((s) => (
          <li key={s.eventId} className="rounded border p-3">
            <Link href={`/eventos/${s.eventId}`}>
              <h2 className="font-semibold">{s.event.title}</h2>
              <p className="text-sm text-gray-600">
                {formatFecha(s.event.startsAt)} · {s.event.venue.name}
              </p>
              <p className="text-sm text-gray-500">
                {s.event.status !== "activo"
                  ? s.event.status === "cancelado" ? "❌ Cancelado" : "⚠ Pospuesto"
                  : s.reminder ? "🔔 Con recordatorio" : "Sin recordatorio"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
