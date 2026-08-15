import { prisma } from "@/lib/db";
import { formatFecha, formatPrecio } from "@/lib/format";
import { googleCalendarUrl, androidCalendarIntentUrl } from "@/lib/calendar";
import {
  CLASES_ETIQUETA,
  CLASES_ETIQUETA_HUERFANA,
  infoCategoria,
} from "@/lib/events/categorias";
import { getSessionUserId } from "@/lib/auth/session";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, ROTULO } from "@/lib/ui";
import SaveButton from "@/components/SaveButton";
import GoogleCalendarButton from "@/components/GoogleCalendarButton";
import { notFound } from "next/navigation";
import Link from "next/link";

/** Una fila del bloque de datos: rótulo de andén a la izquierda, dato a la derecha. */
function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-linea py-3.5 sm:flex-row sm:gap-6">
      <dt className={`${ROTULO} shrink-0 pt-0.5 sm:w-24`}>{rotulo}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

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

  const calEvent = {
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    venueName: e.venue.name,
    address: e.venue.address,
    description: e.description,
  };
  const gcal = googleCalendarUrl(calEvent);
  const gcalIntent = androidCalendarIntentUrl(calEvent);
  // Ojo con `e.priceMin ? …`: 0 es un precio real (entrada libre), no un hueco.
  const precio = formatPrecio(
    e.priceMin != null ? Number(e.priceMin) : null,
    e.priceMax != null ? Number(e.priceMax) : null,
  );
  const cat = infoCategoria(e.category);

  return (
    <main className="mx-auto max-w-[960px] px-4 pt-6 sm:px-6 sm:pt-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ceniza transition-colors hover:text-cal"
      >
        <span aria-hidden>←</span> Toda la cartelera
      </Link>

      {/* Asimétrico a propósito: el póster ancla la columna angosta y el texto
          respira en la ancha. En móvil se apilan, póster primero. */}
      <div className="mt-6 grid gap-8 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-10">
        <div>
          {e.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={e.imageUrl}
              alt=""
              className="aspect-[3/4] w-full border border-linea object-cover sm:sticky sm:top-[72px]"
            />
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center border border-linea bg-fierro-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ceniza">
              Sin póster
            </div>
          )}
        </div>

        <div className="min-w-0">
          <span className={`${CLASES_ETIQUETA} ${cat?.clases ?? CLASES_ETIQUETA_HUERFANA}`}>
            {cat?.nombre ?? e.category}
          </span>

          <h1 className="mt-4 font-display text-[clamp(2rem,5.5vw,3.4rem)] uppercase leading-[1.04] tracking-[0.11em] text-balance">
            {e.title}
          </h1>

          {e.status !== "activo" && (
            <p className="mt-5 border-l-2 border-alerta bg-alerta/10 px-3.5 py-2.5 font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em] text-alerta">
              {e.status === "cancelado" ? "Cancelado" : "Pospuesto"}
            </p>
          )}

          <dl className="mt-7 border-t border-linea">
            <Dato rotulo="Cuándo">
              <span className="font-mono tabular-nums text-cal">{formatFecha(e.startsAt)}</span>
            </Dato>
            <Dato rotulo="Dónde">
              <span className="text-cal">{e.venue.name}</span>
              {e.venue.address && (
                <span className="mt-0.5 block text-sm text-ceniza">{e.venue.address}</span>
              )}
            </Dato>
            {precio && (
              <Dato rotulo="Precio">
                <span className="font-mono tabular-nums text-cal">{precio}</span>
              </Dato>
            )}
          </dl>

          {e.description && (
            <p className="mt-6 max-w-prose leading-relaxed text-ceniza">{e.description}</p>
          )}

          <div className="mt-8 flex flex-wrap gap-2.5">
            {e.ticketUrl && (
              <a
                href={e.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={BOTON_PRIMARIO}
              >
                {/* Un evento de entrada libre (CONARTE, Luma) no tiene boletos que
                    comprar: el enlace es su página, no una taquilla. */}
                {e.priceMin != null && Number(e.priceMin) === 0 ? "Más info" : "Boletos"}
              </a>
            )}
            <SaveButton eventId={e.id} saved={saved} reminderPref={reminderPref} />
            <GoogleCalendarButton webUrl={gcal} androidIntentUrl={gcalIntent} />
            <a href={`/eventos/${e.id}/ics`} className={BOTON_SECUNDARIO}>
              Apple Calendar
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
