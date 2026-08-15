import { NormalizedEvent } from "@/lib/events/types";

export interface Connector {
  slug: string; // identificador estable, coincide con Source.slug
  name: string;
  /**
   * Cuántos eventos suele traer la fuente como para que una caída a cero sea
   * sospechosa. Las fuentes chicas (CONARTE ronda los 5 en 3 semanas) necesitan
   * un umbral más bajo que el default, o su caída no alertaría nunca.
   */
  minExpected?: number;
  fetchEvents(): Promise<NormalizedEvent[]>;
}

export const MIN_ESPERADO_DEFAULT = 5;

/** La fuente traía eventos y ahora trae 0 (o falló): revisar el conector. */
export function hayCaida(opts: {
  ok: boolean;
  count: number;
  prevCount: number;
  minExpected?: number;
}): boolean {
  if (!opts.ok) return true;
  return opts.prevCount >= (opts.minExpected ?? MIN_ESPERADO_DEFAULT) && opts.count === 0;
}
