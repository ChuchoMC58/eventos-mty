import { prisma } from "@/lib/db";
import { formatDia, formatHora, formatPrecio } from "@/lib/format";
import {
  CATEGORIAS_EN_ORDEN,
  CLASES_ETIQUETA,
  CLASES_ETIQUETA_HUERFANA,
  infoCategoria,
} from "@/lib/events/categorias";
import { mesesDisponibles, nombreRango, rangoFechas, vecinos } from "@/lib/events/rangos";
import FiltrosBusqueda from "@/components/FiltrosBusqueda";
import Link from "next/link";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

/**
 * Atajos de fecha. "Este mes" ya no está: con el paginado por meses sería la
 * misma consulta que la primera página, con dos controles distintos para lo
 * mismo. La query `?fecha=mes` sigue sirviendo (ver `rangoFechas`).
 */
const FECHAS = [
  { valor: "hoy", nombre: "Hoy" },
  { valor: "finde", nombre: "Este fin" },
];

/**
 * Tope de la consulta. Una página de mes trae ~80 y nunca se acerca, pero una
 * búsqueda barre todo el futuro (340 eventos al 2026-08-11) y ahí sí hace falta.
 */
const TOPE = 250;

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

/**
 * Los filtros son pestañas de tablero, no píldoras: versalita mono, y la activa
 * entre corchetes de --senal. Era un filete de 2 px debajo —el subrayado que
 * sale por defecto— hasta el 2026-08-11.
 *
 * Los corchetes viven en `globals.css` (`.pestana`), con el porqué.
 */
function tab(activo: boolean): string {
  const base = "pestana font-mono text-[0.7rem] uppercase tracking-[0.14em] transition-colors";
  return activo
    ? `${base} pestana-activa text-cal`
    : `${base} text-ceniza hover:text-cal`;
}

/** Los saltos de mes del pie: más peso que una pestaña, son el paso siguiente. */
const pager =
  "border border-linea px-4 py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ceniza transition-colors hover:border-cal hover:text-cal";

export default async function Explorar({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: string;
    fecha?: string;
    venue?: string;
    fuente?: string;
    q?: string;
    mes?: string;
  }>;
}) {
  // `fuente` (slug del conector) no tiene chip: es para revisar qué trae cada
  // fuente después de una ingesta, no un filtro que le sirva al público.
  const { categoria, fecha, venue, fuente, q: qRaw, mes } = await searchParams;
  // Un `q` vacío llega igual porque el form serializa todos sus campos.
  const q = qRaw?.trim() || undefined;

  // Un solo `now` para toda la página: con `new Date()` suelto por ahí, el
  // rango de la consulta y el de las pestañas podrían caer en meses distintos
  // si el render cruza la medianoche del día 1.
  const ahora = new Date();
  const seleccion = { fecha, mes, q };
  const meses = mesesDisponibles(ahora);
  // El mes efectivo: sin `mes` en la query la cartelera está en el actual, y la
  // pestaña se tiene que ver encendida igual. Con un atajo o una búsqueda
  // abierta no manda ninguno.
  const mesActivo = meses.some((m) => m.valor === mes)
    ? mes
    : fecha || q
      ? undefined
      : meses[0].valor;

  // Todo menos el venue: sirve para los eventos Y para contar cuántos tiene
  // cada lugar con los filtros puestos, que es lo que se ve en el desplegable.
  const filtros = {
    status: "activo",
    city: "monterrey",
    startsAt: rangoFechas(seleccion, ahora),
    ...(categoria ? { category: categoria } : {}),
    ...(fuente ? { sources: { some: { source: { slug: fuente } } } } : {}),
    // Acentos: `insensitive` sólo iguala mayúsculas, así que "musica" NO
    // encuentra "música". Haría falta `unaccent` en Postgres; por ahora no.
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { venue: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [events, venues, conteos] = await Promise.all([
    prisma.event.findMany({
      where: { ...filtros, ...(venue ? { venueId: venue } : {}) },
      include: { venue: true },
      orderBy: { startsAt: "asc" },
      take: TOPE,
    }),
    prisma.venue.findMany({ where: { city: "monterrey" }, orderBy: { name: "asc" } }),
    prisma.event.groupBy({ by: ["venueId"], where: filtros, _count: { _all: true } }),
  ]);

  // Sólo los lugares que aportan algo con los filtros actuales. El seleccionado
  // se queda aunque dé 0: si desapareciera, el desplegable diría "Todos los
  // lugares" mientras el filtro sigue aplicado.
  const porVenue = new Map(conteos.map((c) => [c.venueId, c._count._all]));
  const opcionesVenue = venues
    .filter((v) => porVenue.has(v.id) || v.id === venue)
    .map((v) => ({ id: v.id, name: v.name, total: porVenue.get(v.id) ?? 0 }));

  // Agrupar por día calendario, en orden cronológico
  const dias = new Map<string, typeof events>();
  for (const e of events) {
    const key = e.startsAt.toDateString();
    const grupo = dias.get(key);
    if (grupo) grupo.push(e);
    else dias.set(key, [e]);
  }

  const { previo, siguiente } = vecinos(mesActivo, ahora);

  // El escalonado de entrada corre a lo largo de TODA la cartelera, no se
  // reinicia en cada día: si no, las primeras filas de cada bloque entrarían a
  // la vez y se perdería la lectura de arriba hacia abajo.
  let fila = 0;

  return (
    <main className="mx-auto max-w-[1100px] px-4 sm:px-6">
      <section className="pt-10 pb-1 sm:pt-12">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-ceniza">
          Monterrey, N.L. — Cartelera
        </p>
        <h1 className="mt-3.5 font-display text-[clamp(2.5rem,8vw,4.6rem)] uppercase leading-[1.04] tracking-[0.11em] text-balance">
          Qué hay
          <br />
          {/* El -ml cancela el hueco que `tracking` deja DESPUÉS de la última
              letra: sin él, el punto queda flotando lejos de la "y". */}
          en Monterrey<span className="-ml-[0.11em] text-senal">.</span>
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href="/perfil"
            className="bg-senal px-5 py-3 font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-fierro transition-[filter] hover:brightness-110"
          >
            Quiero el resumen semanal
          </Link>
          <p className="max-w-xs text-sm leading-snug text-ceniza">
            Por WhatsApp, con los eventos que van contigo. Sin spam.
          </p>
        </div>
      </section>

      {/*
        Franja de estado: cuántos eventos hay con los filtros puestos. El "+"
        aparece cuando se topa el `TOPE` de la consulta, así que ese número
        quiere decir "esos o más".

        Va como UNA frase y no como datos sueltos: separados ("100+ EVENTOS" /
        "PRÓXIMOS") se leían como dos cifras distintas y no se entendía que la
        segunda describe a la primera.
      */}
      <p className="mt-9 border-y border-linea py-2.5 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ceniza">
        <span className="text-cal tabular-nums">{events.length}</span>
        {/* "1 eventos" no; y con el "+" del tope siempre es plural. */}
        {events.length === TOPE ? "+ eventos" : events.length === 1 ? " evento" : " eventos"}{" "}
        {nombreRango(seleccion, ahora)}
        {categoria && (
          <>
            {" · "}
            <span className="text-cal">{infoCategoria(categoria)?.nombre ?? categoria}</span>
          </>
        )}
      </p>

      <nav
        className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-6 pb-5"
        aria-label="Filtros"
      >
        <Link href={urlCon({ fecha, mes, venue, q })} className={tab(!categoria)}>
          Todo
        </Link>
        {CATEGORIAS_EN_ORDEN.map((c) => (
          <Link
            key={c.slug}
            href={urlCon({ categoria: c.slug, fecha, mes, venue, q })}
            className={tab(categoria === c.slug)}
          >
            {c.nombre}
          </Link>
        ))}
        <span className="h-4 w-px bg-linea" aria-hidden />
        {FECHAS.map((f) => (
          <Link
            key={f.valor}
            // Elegir un atajo suelta la página de mes: son el mismo eje.
            href={urlCon({ categoria, venue, q, fecha: fecha === f.valor ? undefined : f.valor })}
            className={tab(fecha === f.valor)}
          >
            {f.nombre}
          </Link>
        ))}
        {/*
          El paginado: una página por mes, del actual a los tres siguientes. Va
          en la misma fila que los atajos porque es el mismo eje —fecha— y tener
          dos controles de fecha separados invita a combinarlos, que es justo lo
          que no se puede.
        */}
        {meses.map((m) => (
          <Link
            key={m.valor}
            href={urlCon({ categoria, venue, q, mes: m.valor })}
            className={tab(mesActivo === m.valor)}
          >
            {m.etiqueta}
          </Link>
        ))}
      </nav>

      <FiltrosBusqueda
        venues={opcionesVenue}
        q={q}
        venue={venue}
        categoria={categoria}
        fecha={fecha}
        mes={mes}
      />

      {events.length === 0 && (
        <p className="border-t border-linea py-14 text-ceniza">
          {q ? `Nada que coincida con «${q}».` : "No hay eventos con esos filtros."}{" "}
          {q || venue ? (
            <Link
              href={urlCon({ categoria, fecha, mes })}
              className="text-senal underline underline-offset-4 hover:brightness-110"
            >
              Quitar búsqueda y lugar
            </Link>
          ) : (
            "Prueba con otra categoría o fecha."
          )}
        </p>
      )}

      {[...dias.entries()].map(([key, grupo]) => {
        const rel = etiquetaRelativa(grupo[0].startsAt);
        return (
          <section key={key}>
            {/*
              El numeral del día es el número pintado en el andén: grande, sólido
              y alineado con la columna de horas, para que la vista baje por una
              sola línea de cifras.

              La barra NO es pegajosa (a propósito, 2026-08-10): antes se quedaba
              fija bajo la cabecera y viajaba hacia abajo montándose sobre los
              eventos, que además se pintaban por encima de ella y la dejaban
              ilegible. En el flujo no se solapa con nada y no hace falta z-index.
            */}
            <h2 className="-mx-4 mt-8 flex items-center gap-3 border-y border-linea bg-fierro-2 px-4 py-2 sm:-mx-6 sm:px-6">
              <span className="w-[2.5ch] font-display text-2xl leading-none tabular-nums text-cal sm:w-[3ch] sm:text-3xl">
                {grupo[0].startsAt.getDate()}
              </span>
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ceniza">
                {formatDia(grupo[0].startsAt)}
              </span>
              {rel && (
                <span className="border-l-2 border-senal pl-2 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-senal">
                  {rel}
                </span>
              )}
            </h2>

            <ul className="relative">
              {grupo.map((e) => {
                // Ojo con `e.priceMin ? …`: 0 es un precio real (entrada libre).
                const precio = formatPrecio(
                  e.priceMin != null ? Number(e.priceMin) : null,
                  e.priceMax != null ? Number(e.priceMax) : null,
                );
                const cat = infoCategoria(e.category);
                return (
                  <li
                    key={e.id}
                    className="entra border-b border-linea last:border-b-0"
                    style={{ "--i": fila++ } as CSSProperties}
                  >
                    <Link
                      href={`/eventos/${e.id}`}
                      className="group grid grid-cols-[4.6rem_1fr] items-start gap-x-3 gap-y-3 py-4 transition-colors hover:bg-cal/[0.025] sm:grid-cols-[6.5rem_1fr_auto] sm:items-center sm:gap-x-6 sm:py-5"
                    >
                      {/* La hora manda la composición: es lo memorable. */}
                      <time
                        dateTime={e.startsAt.toISOString()}
                        className="font-mono text-[0.82rem] leading-tight whitespace-nowrap tabular-nums text-cal sm:text-lg"
                      >
                        {formatHora(e.startsAt)}
                      </time>

                      <div className="flex min-w-0 items-start gap-3.5 sm:gap-5">
                        <span className="h-20 w-16 shrink-0 overflow-hidden border border-linea bg-fierro-2 sm:h-28 sm:w-[5.25rem]">
                          {e.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={e.imageUrl}
                              alt=""
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center font-mono text-[0.6rem] text-ceniza">
                              —
                            </span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[1.05rem] font-bold leading-snug tracking-[0.01em] transition-colors group-hover:text-senal sm:text-xl">
                            {e.title}
                          </span>
                          <span className="mt-1.5 block font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ceniza">
                            {e.venue.name}
                          </span>
                        </span>
                      </div>

                      {/*
                        El costado derecho lleva datos, no aire: categoría y
                        precio. Con la fila a 1100 px, dejar sólo la etiqueta ahí
                        abría un hueco de media pantalla en medio de cada evento.
                      */}
                      <span className="col-start-2 flex items-center gap-4 sm:col-start-3 sm:gap-6">
                        <span
                          className={`${CLASES_ETIQUETA} ${cat?.clases ?? CLASES_ETIQUETA_HUERFANA}`}
                        >
                          {cat?.nombre ?? e.category}
                        </span>
                        {/* Ancho fijo y tabular para que los precios formen
                            columna de arriba abajo, como un tablero. */}
                        <span className="font-mono text-[0.72rem] tabular-nums text-ceniza sm:w-24 sm:text-right">
                          {precio ?? "—"}
                        </span>
                        <span
                          className="hidden font-mono text-ceniza transition-transform duration-200 group-hover:translate-x-1 group-hover:text-senal sm:inline"
                          aria-hidden
                        >
                          →
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/*
        Pager de abajo. Repite lo que ya hacen las pestañas, y aun así hace
        falta: el que llega hasta acá lleva 80 eventos de scroll y no va a subir
        a buscar la pestaña. Sólo cuando hay una página de mes — con búsqueda
        abierta no hay "mes siguiente" al que ir.
      */}
      {mesActivo && (
        <nav
          className="mt-10 flex items-center justify-between gap-4 border-t border-linea pt-6 pb-16"
          aria-label="Cambiar de mes"
        >
          {previo ? (
            <Link href={urlCon({ categoria, venue, q, mes: previo.valor })} className={pager}>
              ← {previo.nombre}
            </Link>
          ) : (
            <span />
          )}
          {siguiente ? (
            <Link href={urlCon({ categoria, venue, q, mes: siguiente.valor })} className={pager}>
              {siguiente.nombre} →
            </Link>
          ) : (
            // Fin de la ventana: en vez de un tope mudo, se dice por qué y
            // cómo llegar a lo que queda fuera.
            <span className="text-right font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ceniza">
              Hasta aquí llega la cartelera.
              <br />
              Lo de más adelante, por búsqueda.
            </span>
          )}
        </nav>
      )}
    </main>
  );
}
