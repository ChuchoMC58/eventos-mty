export const CATEGORIES = ["musica", "deportes", "cultura"] as const;
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
