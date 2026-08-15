/**
 * Rangos de fecha de la cartelera.
 *
 * Vivía dentro de `app/page.tsx`; se sacó para poder probarlo con un `now` fijo
 * — la lógica de "hasta dónde mostramos" es justo la que se rompe sola con el
 * paso del tiempo (ver el bug de "Este mes", que traía eventos del mes
 * siguiente porque era una ventana rodante de 30 días).
 *
 * Las fechas se calculan en la TZ del proceso, igual que el resto de la app:
 * producción corre en America/Monterrey.
 */

/**
 * Meses futuros navegables, además del mes en curso. Cuatro páginas en total.
 *
 * El número sale de la densidad real del catálogo: al 2026-08-11 había 82/75/81
 * eventos en ago-sep-oct, 55 en noviembre y luego el desplome a 27/9/7/3/1. De
 * diciembre en adelante deja de ser una cartelera y pasa a ser una lista suelta
 * de anuncios de Arena Monterrey, que no le sirve a nadie para decidir qué
 * hacer. Lo que queda fuera de la ventana NO se esconde: sigue saliendo al
 * buscar por nombre (ver `rangoFechas`).
 */
export const MESES_ADELANTE = 3;

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export interface OpcionMes {
  /** Clave de la query, "2026-09". */
  valor: string;
  /** Para la pestaña: "SEP", o "ENE 27" cuando cruza el año. */
  etiqueta: string;
  /** Para la franja de conteo: "septiembre". */
  nombre: string;
}

/** "2026-09" a partir de un Date, en la TZ del proceso. */
function clave(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Los meses que la cartelera deja navegar, del actual al último de la ventana. */
export function mesesDisponibles(now: Date = new Date()): OpcionMes[] {
  const opciones: OpcionMes[] = [];
  for (let i = 0; i <= MESES_ADELANTE; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    // El año sólo se dice cuando la ventana lo cruza: en octubre sobra "26" en
    // las cuatro pestañas, pero en noviembre "ENE" a secas se lee como pasado.
    const anio = d.getFullYear() !== now.getFullYear() ? ` ${String(d.getFullYear()).slice(2)}` : "";
    opciones.push({
      valor: clave(d),
      etiqueta: `${MESES_CORTOS[d.getMonth()]}${anio}`,
      nombre: MESES_LARGOS[d.getMonth()],
    });
  }
  return opciones;
}

/** El primer instante del mes `valor`, o null si no es un mes de la ventana. */
function inicioDeMes(valor: string | undefined, now: Date): Date | null {
  if (!valor) return null;
  const opciones = mesesDisponibles(now);
  const i = opciones.findIndex((o) => o.valor === valor);
  if (i < 0) return null; // mes inválido o fuera de la ventana: se ignora
  return new Date(now.getFullYear(), now.getMonth() + i, 1);
}

export interface Seleccion {
  fecha?: string;
  mes?: string;
  q?: string;
}

/**
 * El rango que se le pasa a Prisma como `startsAt`.
 *
 * Precedencia: los atajos (`hoy`, `finde`) mandan; luego la página de mes; y si
 * no hay nada elegido, el mes en curso — salvo que haya búsqueda, que ve TODO
 * el futuro. Esa excepción es a propósito: los shows grandes se anuncian con un
 * año de anticipación y son justo los que la gente busca por nombre; que
 * "Camilo" no aparezca porque cae en marzo de 2027 se lee como que la app no lo
 * sabe. Navegar sí se limita a la ventana; buscar no.
 */
export function rangoFechas(seleccion: Seleccion, now: Date = new Date()): { gte: Date; lt?: Date } {
  const { fecha, mes, q } = seleccion;

  if (fecha === "hoy") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { gte: now, lt: end };
  }

  if (fecha === "finde") {
    const day = now.getDay();
    const enFinde = day === 5 || day === 6 || day === 0;
    const viernes = new Date(now);
    viernes.setHours(0, 0, 0, 0);
    // Estando YA en el fin, el viernes es el que acaba de pasar. Antes se
    // buscaba siempre el viernes SIGUIENTE, así que un sábado "Este fin"
    // abarcaba nueve días: lo que quedaba de ese fin, la semana entera y el fin
    // siguiente completo.
    viernes.setDate(viernes.getDate() + (enFinde ? -((day - 5 + 7) % 7) : (5 - day + 7) % 7));
    const lunes = new Date(viernes);
    lunes.setDate(viernes.getDate() + 3);
    return { gte: enFinde ? now : viernes, lt: lunes };
  }

  const inicio = inicioDeMes(mes, now);
  if (inicio) {
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    // El mes en curso arranca AHORA, no el día 1: lo que ya pasó no es cartelera.
    return { gte: inicio > now ? inicio : now, lt: fin };
  }

  // Sin mes elegido: buscar barre todo el futuro; navegar se queda en el mes
  // en curso. `fecha=mes` era la pestaña vieja y cae aquí, que es lo mismo que
  // hacía — los enlaces ya compartidos siguen funcionando.
  if (q && fecha !== "mes") return { gte: now };
  return { gte: now, lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

/** Cómo se llama el rango en la franja de conteo: "hoy", "en septiembre"… */
export function nombreRango(seleccion: Seleccion, now: Date = new Date()): string {
  const { fecha, mes, q } = seleccion;
  if (fecha === "hoy") return "hoy";
  if (fecha === "finde") return "este fin";
  const opciones = mesesDisponibles(now);
  const elegido = opciones.find((o) => o.valor === mes);
  if (elegido) return `en ${elegido.nombre}`;
  if (q && fecha !== "mes") return "próximos";
  return `en ${opciones[0].nombre}`;
}

/** Mes anterior y siguiente DENTRO de la ventana, para el pager de abajo. */
export function vecinos(
  mes: string | undefined,
  now: Date = new Date(),
): { previo?: OpcionMes; siguiente?: OpcionMes } {
  const opciones = mesesDisponibles(now);
  const i = Math.max(
    0,
    opciones.findIndex((o) => o.valor === mes),
  );
  return { previo: opciones[i - 1], siguiente: opciones[i + 1] };
}
