import { prisma } from "@/lib/db";
import { formatDia, formatHora, formatPrecio } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

/** "Hoy" / "Mañana" para fechas cercanas; null para el resto. */
function etiquetaRelativa(d: Date): string | null {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const diff = Math.round((dia.getTime() - hoy.getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return null;
}

function chip(activo: boolean): string {
  return activo
    ? "rounded-full border border-hueso bg-hueso px-3.5 py-1.5 text-sm font-bold text-ink"
    : "rounded-full border border-linea px-3.5 py-1.5 text-sm text-humo transition-colors hover:border-humo hover:text-hueso";
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

  // Agrupar por día calendario, en orden cronológico
  const dias = new Map<string, typeof events>();
  for (const e of events) {
    const key = e.startsAt.toDateString();
    const grupo = dias.get(key);
    if (grupo) grupo.push(e);
    else dias.set(key, [e]);
  }

  return (
    <main className="mx-auto max-w-3xl px-4">
      <section className="pt-12 pb-2">
        <h1 className="font-display text-4xl uppercase leading-[0.98] tracking-tight text-balance sm:text-5xl">
          Qué hay en <span className="text-musica">Monterrey.</span>
        </h1>
        <p className="mt-3 text-humo">Para no volver a decir «no me enteré».</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/perfil"
            className="rounded-md bg-musica px-5 py-2.5 text-sm font-extrabold text-ink transition-[filter] hover:brightness-110"
          >
            Quiero el resumen semanal
          </Link>
          <span className="text-sm text-humo">Por WhatsApp, con los eventos que van contigo. Sin spam.</span>
        </div>
      </section>

      <nav className="flex flex-wrap items-center gap-2 pt-6 pb-3" aria-label="Filtros">
        <Link href={urlCon({ fecha, venue })} className={chip(!categoria)}>
          Todo
        </Link>
        {Object.entries(NOMBRE_CATEGORIA).map(([valor, nombre]) => (
          <Link
            key={valor}
            href={urlCon({ categoria: valor, fecha, venue })}
            className={chip(categoria === valor)}
          >
            {nombre}
          </Link>
        ))}
        <span className="mx-1.5 h-4.5 w-px bg-linea" />
        {FECHAS.map((f) => (
          <Link
            key={f.valor}
            href={urlCon({ categoria, venue, fecha: fecha === f.valor ? undefined : f.valor })}
            className={chip(fecha === f.valor)}
          >
            {f.nombre}
          </Link>
        ))}
      </nav>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 pb-6 text-sm" aria-label="Venues">
        {venues.map((v) => (
          <Link
            key={v.id}
            href={urlCon({ categoria, fecha, venue: venue === v.id ? undefined : v.id })}
            className={
              venue === v.id
                ? "font-bold text-musica"
                : "text-humo transition-colors hover:text-hueso"
            }
          >
            {v.name}
          </Link>
        ))}
      </nav>

      {events.length === 0 && (
        <p className="border-t border-linea py-10 text-humo">
          No hay eventos con esos filtros. Prueba con otra categoría o fecha.
        </p>
      )}

      {[...dias.entries()].map(([key, grupo]) => {
        const rel = etiquetaRelativa(grupo[0].startsAt);
        return (
          <section key={key} className="border-t border-linea">
            <h2 className="sticky top-[49px] z-10 flex items-baseline gap-2 bg-ink pt-3.5 pb-2.5 text-xs font-bold uppercase tracking-[0.14em]">
              {rel && <span className="text-musica">{rel}</span>}
              <span className={rel ? "font-semibold text-humo" : "text-hueso"}>
                {rel ? `· ${formatDia(grupo[0].startsAt)}` : formatDia(grupo[0].startsAt)}
              </span>
            </h2>
            <ul>
              {grupo.map((e, i) => (
                <li key={e.id} className={i > 0 ? "border-t border-linea" : ""}>
                  <Link
                    href={`/eventos/${e.id}`}
                    className="group grid grid-cols-[60px_1fr] items-center gap-x-4 gap-y-2 py-4 sm:grid-cols-[72px_1fr_auto]"
                  >
                    <span className="text-sm font-semibold tracking-wide whitespace-nowrap text-humo tabular-nums">
                      {formatHora(e.startsAt)}
                    </span>
                    <span className="flex items-center gap-3">
                      {e.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.imageUrl}
                          alt=""
                          className="h-13 w-13 shrink-0 rounded border border-linea object-cover"
                        />
                      )}
                      <span>
                        <span className="block text-lg font-extrabold leading-snug tracking-tight transition-colors group-hover:text-musica">
                          {e.title}
                        </span>
                        <span className="block text-sm text-humo">
                          {e.venue.name}
                          {formatPrecio(e.priceMin ? Number(e.priceMin) : null, e.priceMax ? Number(e.priceMax) : null)
                            ? ` · ${formatPrecio(Number(e.priceMin), e.priceMax ? Number(e.priceMax) : null)}`
                            : ""}
                        </span>
                      </span>
                    </span>
                    <span className="col-start-2 flex items-center gap-3.5 sm:col-start-3">
                      <span
                        className={`rounded-sm px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] ${ESTILO_CATEGORIA[e.category] ?? "bg-hueso/10 text-humo"}`}
                      >
                        {NOMBRE_CATEGORIA[e.category] ?? e.category}
                      </span>
                      <span className="hidden text-humo transition-transform group-hover:translate-x-1 group-hover:text-hueso sm:inline">
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="pb-14" />
    </main>
  );
}
