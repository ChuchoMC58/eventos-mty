import { prisma } from "@/lib/db";
import { formatFecha, formatPrecio } from "@/lib/format";
import { googleCalendarUrl } from "@/lib/calendar";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function DetalleEvento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.event.findUnique({ where: { id }, include: { venue: true } });
  if (!e) notFound();

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
    <main className="mx-auto max-w-2xl p-4">
      <Link href="/" className="text-sm text-gray-500">← Todos los eventos</Link>
      {e.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.imageUrl} alt="" className="my-3 max-h-72 w-full rounded object-cover" />
      )}
      <h1 className="text-2xl font-bold">{e.title}</h1>
      {e.status !== "activo" && (
        <p className="font-semibold text-red-600">{e.status === "cancelado" ? "❌ Cancelado" : "⚠ Pospuesto"}</p>
      )}
      <p className="text-gray-700">{formatFecha(e.startsAt)}</p>
      <p className="text-gray-700">
        {e.venue.name}
        {e.venue.address ? ` · ${e.venue.address}` : ""}
      </p>
      {precio && <p className="text-gray-700">{precio}</p>}
      {e.description && <p className="my-3">{e.description}</p>}

      <div className="my-4 flex flex-wrap gap-2">
        {e.ticketUrl && (
          <a href={e.ticketUrl} target="_blank" rel="noopener noreferrer" className="rounded bg-black px-4 py-2 text-white">
            Boletos
          </a>
        )}
        <a href={gcal} target="_blank" rel="noopener noreferrer" className="rounded border px-4 py-2">
          Google Calendar
        </a>
        <a href={`/eventos/${e.id}/ics`} className="rounded border px-4 py-2">
          Apple/Outlook (.ics)
        </a>
      </div>
    </main>
  );
}
