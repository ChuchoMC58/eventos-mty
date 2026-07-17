import { prisma } from "@/lib/db";
import { formatFecha, formatPrecio } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const NOMBRE_CATEGORIA: Record<string, string> = {
  musica: "Música",
  deportes: "Deportes",
  cultura: "Cultura",
};
const FECHAS = [
  { valor: "hoy", nombre: "Hoy" },
  { valor: "finde", nombre: "Este fin" },
  { valor: "mes", nombre: "Este mes" },
];

function rangoFechas(fecha?: string): { gte: Date; lt?: Date } {
  const now = new Date();
  if (fecha === "hoy") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { gte: now, lt: end };
  }
  if (fecha === "finde") {
    const day = now.getDay();
    const viernes = new Date(now);
    viernes.setHours(0, 0, 0, 0);
    viernes.setDate(viernes.getDate() + ((5 - day + 7) % 7));
    const lunes = new Date(viernes);
    lunes.setDate(viernes.getDate() + 3);
    const enFinde = day === 5 || day === 6 || day === 0;
    return { gte: enFinde ? now : viernes, lt: lunes };
  }
  if (fecha === "mes") {
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    return { gte: now, lt: end };
  }
  return { gte: now };
}

function urlCon(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function Explorar({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; fecha?: string; venue?: string }>;
}) {
  const { categoria, fecha, venue } = await searchParams;
  const [events, venues] = await Promise.all([
    prisma.event.findMany({
      where: {
        status: "activo",
        city: "monterrey",
        startsAt: rangoFechas(fecha),
        ...(categoria ? { category: categoria } : {}),
        ...(venue ? { venueId: venue } : {}),
      },
      include: { venue: true },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
    prisma.venue.findMany({ where: { city: "monterrey" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="text-2xl font-bold">Eventos en Monterrey</h1>
      <p className="mb-4 text-sm text-gray-500">Para no volver a decir “no me enteré”.</p>

      <nav className="mb-2 flex flex-wrap gap-2">
        <Link href={urlCon({ fecha, venue })} className={!categoria ? "font-bold underline" : ""}>
          Todo
        </Link>
        {Object.entries(NOMBRE_CATEGORIA).map(([valor, nombre]) => (
          <Link
            key={valor}
            href={urlCon({ categoria: valor, fecha, venue })}
            className={categoria === valor ? "font-bold underline" : ""}
          >
            {nombre}
          </Link>
        ))}
        <span className="text-gray-300">|</span>
        {FECHAS.map((f) => (
          <Link
            key={f.valor}
            href={urlCon({ categoria, venue, fecha: fecha === f.valor ? undefined : f.valor })}
            className={fecha === f.valor ? "font-bold underline" : ""}
          >
            {f.nombre}
          </Link>
        ))}
      </nav>

      <nav className="mb-4 flex flex-wrap gap-2 text-sm text-gray-600">
        {venues.map((v) => (
          <Link
            key={v.id}
            href={urlCon({ categoria, fecha, venue: venue === v.id ? undefined : v.id })}
            className={venue === v.id ? "font-bold underline" : ""}
          >
            {v.name}
          </Link>
        ))}
      </nav>

      {events.length === 0 && <p>No hay eventos con esos filtros.</p>}

      <ul className="space-y-3">
        {events.map((e) => (
          <li key={e.id} className="rounded border p-3">
            <Link href={`/eventos/${e.id}`} className="block">
              <div className="flex gap-3">
                {e.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />
                )}
                <div>
                  <h2 className="font-semibold">{e.title}</h2>
                  <p className="text-sm text-gray-600">
                    {formatFecha(e.startsAt)} · {e.venue.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {NOMBRE_CATEGORIA[e.category]}
                    {formatPrecio(e.priceMin ? Number(e.priceMin) : null, e.priceMax ? Number(e.priceMax) : null)
                      ? ` · ${formatPrecio(Number(e.priceMin), e.priceMax ? Number(e.priceMax) : null)}`
                      : ""}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
