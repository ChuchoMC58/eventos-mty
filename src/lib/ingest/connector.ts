import { NormalizedEvent } from "@/lib/events/types";

export interface Connector {
  slug: string; // identificador estable, coincide con Source.slug
  name: string;
  fetchEvents(): Promise<NormalizedEvent[]>;
}
