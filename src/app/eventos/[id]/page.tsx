import { prisma } from "@/lib/db";
import { formatFecha, formatPrecio } from "@/lib/format";
import { googleCalendarUrl } from "@/lib/calendar";
import { getSessionUserId } from "@/lib/auth/session";
import SaveButton from "@/components/SaveButton";
import { notFound } from "next/navigation";
import Link from "next/link";

const NOMBRE_CATEGORIA: Record<string, string> = {
  musica: "Música",
  deportes: "Deportes",
  cultura: "Cultura",
};
const ESTILO_CATEGORIA: Record<string, string> = {
  musica: "text-musica bg-musica/15",
  deportes: "text-deportes bg-deportes/15",
  cultura: "text-cultura bg-cultura/15",
};

export default async function DetalleEvento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.event.findUnique({ where: { id }, include: { venue: true } });
  if (!e) notFound();

  const userId = await getSessionUserId();
  let saved = false;
  let reminderPref: string | null = null;
  if (userId) {
    const [savedEvent, user] = await Promise.all([
      prisma.savedEvent.findUnique({ where: { userId_eventId: { userId, eventId: id } } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);
    saved = Boolean(savedEvent);
    reminderPref = user?.reminderPref ?? null;
  }

  const gcal = googleCalendarUrl({
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    venueName: e.venue.name,
    address: e.venue.address,
    description: e.description,
  });
  const precio = formatPrecio(e.priceMin ? Number(e.priceMin) : null, e.priceMax ? Number(e.priceMax) : null);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/" className="text-sm text-humo transition-colors hover:text-hueso">
        ← Todos los eventos
      </Link>
      {e.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={e.imageUrl}
          alt=""
          className="my-4 max-h-72 w-full rounded-lg border border-linea object-cover"
        />
      )}
      <span
        className={`mt-4 block w-fit rounded-sm px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] ${ESTILO_CATEGORIA[e.category] ?? "bg-hueso/10 text-humo"}`}
      >
        {NOMBRE_CATEGORIA[e.category] ?? e.category}
      </span>
      <h1 className="mt-3 font-display text-3xl uppercase leading-tight tracking-tight text-balance">
        {e.title}
      </h1>
      {e.status !== "activo" && (
        <p className="mt-2 font-bold text-red-400">
          {e.status === "cancelado" ? "❌ Cancelado" : "⚠ Pospuesto"}
        </p>
      )}
      <div className="mt-3 space-y-1 text-humo">
        <p className="font-semibold text-hueso">{formatFecha(e.startsAt)}</p>
        <p>
          {e.venue.name}
          {e.venue.address ? ` · ${e.venue.address}` : ""}
        </p>
        {precio && <p>{precio}</p>}
      </div>
      {e.description && <p className="my-4 leading-relaxed">{e.description}</p>}

      <div className="my-6 flex flex-wrap gap-2.5">
        {e.ticketUrl && (
          <a
            href={e.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-musica px-5 py-2.5 text-sm font-extrabold text-ink transition-[filter] hover:brightness-110"
          >
            Boletos
          </a>
        )}
        <SaveButton eventId={e.id} saved={saved} reminderPref={reminderPref} />
        <a
          href={gcal}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-linea px-5 py-2.5 text-sm text-hueso transition-colors hover:border-humo"
        >
          Google Calendar
        </a>
        <a
          href={`/eventos/${e.id}/ics`}
          className="rounded-md border border-linea px-5 py-2.5 text-sm text-hueso transition-colors hover:border-humo"
        >
          Apple/Outlook (.ics)
        </a>
      </div>
    </main>
  );
}
