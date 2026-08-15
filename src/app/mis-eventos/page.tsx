import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth/session";
import { formatFecha } from "@/lib/format";
import { ROTULO } from "@/lib/ui";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";

export default async function MisEventos() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/entrar?next=/mis-eventos");
  // Sólo lo que está por venir, con el mismo corte que la cartelera (`gte: now`,
  // no el inicio del día): un evento que ya empezó deja de ser un plan. Los
  // pasados NO se borran de la BD, sólo se sacan de la lista.
  const saved = await prisma.savedEvent.findMany({
    where: { userId, event: { startsAt: { gte: new Date() } } },
    include: { event: { include: { venue: true } } },
    orderBy: { event: { startsAt: "asc" } },
  });

  return (
    <main className="mx-auto max-w-[960px] px-4 pt-12 sm:px-6 sm:pt-16">
      {/* Aquí el rótulo va DEBAJO del titular (en el resto de las páginas va
          encima): a pedido del usuario, 2026-08-11. */}
      <h1 className="font-display text-[clamp(2.2rem,7vw,3.6rem)] uppercase leading-[1.04] tracking-[0.11em]">
        Mis eventos
      </h1>
      <p className={`${ROTULO} mt-3`}>Guardados</p>

      {saved.length === 0 && (
        <p className="py-14 text-ceniza">
          No tienes ningún evento guardado.{" "}
          <Link href="/" className="text-senal underline underline-offset-4 hover:brightness-110">
            Explora la cartelera
          </Link>
          .
        </p>
      )}

      {/* El filete de arriba lo ponía la franja de conteo, que se quitó; sin él
          la primera fila arrancaba sin línea y rompía la retícula. Va en el
          `<ul>` y no suelto para que con la lista vacía no quede una raya
          huérfana bajo el mensaje. */}
      <ul className={saved.length > 0 ? "mt-8 border-t border-linea" : undefined}>
        {saved.map((s, i) => {
          const cancelado = s.event.status !== "activo";
          return (
            <li
              key={s.eventId}
              className="entra border-b border-linea"
              style={{ "--i": i } as CSSProperties}
            >
              <Link
                href={`/eventos/${s.eventId}`}
                className="group grid grid-cols-1 items-start gap-x-6 gap-y-2 py-5 transition-colors hover:bg-cal/[0.025] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <h2 className="text-lg font-bold leading-snug tracking-[0.01em] transition-colors group-hover:text-senal sm:text-xl">
                    {s.event.title}
                  </h2>
                  <p className="mt-1.5 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ceniza">
                    <span className="tabular-nums text-cal">{formatFecha(s.event.startsAt)}</span>
                    {" · "}
                    {s.event.venue.name}
                  </p>
                </div>
                <span
                  className={`font-mono text-[0.62rem] uppercase leading-tight tracking-[0.14em] ${
                    cancelado
                      ? "border-l-2 border-alerta pl-2 text-alerta"
                      : s.reminder
                        ? "border-l-2 border-senal pl-2 text-senal"
                        : "border-l-2 border-linea pl-2 text-ceniza"
                  }`}
                >
                  {cancelado
                    ? s.event.status === "cancelado"
                      ? "Cancelado"
                      : "Pospuesto"
                    : s.reminder
                      ? "Con recordatorio"
                      : "Sin recordatorio"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
