// El orden es el de los chips de la cartelera. `tecnologia` y `bienestar` son
// para lo que las boleteras no venden (meetups, pilates, clubs de correr) y que
// hasta 2026-08-05 ni se pedía a Luma por no tener dónde ponerlo.
export const CATEGORIES = ["musica", "deportes", "cultura", "tecnologia", "bienestar"] as const;
export type Category = (typeof CATEGORIES)[number];

export type EventStatus = "activo" | "cancelado" | "pospuesto";

// Todo conector produce este tipo; web y digest solo conocen este tipo.
export interface NormalizedEvent {
  title: string;
  description?: string;
  startsAt: Date;
  endsAt?: Date;
  category: Category;
  tags: string[];
  priceMin?: number;
  priceMax?: number;
  ticketUrl?: string;
  imageUrl?: string;
  status: EventStatus;
  venue: { name: string; address?: string; zone?: string };
  city: string; // "monterrey"
}
