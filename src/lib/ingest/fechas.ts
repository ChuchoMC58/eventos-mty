/**
 * Fechas *timezone-naive* → UTC. Compartido por los conectores que reciben la
 * hora local sin offset (CONARTE la publica como "2026-08-06 18:30:00";
 * Superboletos como "06 de Noviembre 21:00 Hrs.").
 *
 * Vivía dentro de `sources/conarte.ts` hasta que Superboletos necesitó lo
 * mismo: importar entre conectores los acopla sin razón.
 */

/**
 * Minutos de offset de una zona horaria en un instante dado. Sirve para
 * interpretar las fechas *timezone-naive* del sitio sin depender de la TZ del
 * proceso: prod corre en America/Monterrey y los tests y el host en UTC, así
 * que un `new Date(naive)` da resultados distintos según dónde corra — el peor
 * modo de fallar.
 */
function offsetMinutos(tz: string, at: Date): number {
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);
    const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
    const comoUtc = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour) % 24,
      Number(p.minute),
      Number(p.second),
    );
    return (comoUtc - at.getTime()) / 60_000;
  } catch {
    return -360; // zona desconocida: centro de México, UTC−6 fijo desde 2022
  }
}

export function fechaZonaAUtc(naive: string, tz: string): Date | null {
  const m = naive.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const comoUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  // Dos pasos: el offset se evalúa en el instante aproximado y luego en el real,
  // para no equivocarse en un cambio de horario (México ya no lo aplica, pero el
  // sitio podría publicar eventos de otra zona).
  const aprox = new Date(comoUtc - offsetMinutos(tz, new Date(comoUtc)) * 60_000);
  return new Date(comoUtc - offsetMinutos(tz, aprox) * 60_000);
}

/** Año y mes/día actuales *en Monterrey*, no en la TZ del proceso. */
export function hoyEnMonterrey(at: Date = new Date()): { year: number; month: number; day: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Monterrey",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}
