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
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-5 font-display text-3xl uppercase tracking-tight">Mis eventos</h1>
      {saved.length === 0 && (
        <p className="text-humo">
          Aún no guardas eventos.{" "}
          <Link href="/" className="text-musica underline underline-offset-3 hover:brightness-110">
            Explora la cartelera
          </Link>
          .
        </p>
      )}
      <ul className="space-y-3">
        {saved.map((s) => (
          <li key={s.eventId}>
            <Link
              href={`/eventos/${s.eventId}`}
              className="group block rounded-lg border border-linea bg-ink-2 p-4 transition-colors hover:border-humo"
            >
              <h2 className="font-extrabold tracking-tight transition-colors group-hover:text-musica">
                {s.event.title}
              </h2>
              <p className="text-sm text-humo">
                {formatFecha(s.event.startsAt)} · {s.event.venue.name}
              </p>
              <p className="mt-1 text-sm text-humo">
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
