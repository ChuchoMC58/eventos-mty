import { Connector } from "./connector";
import { ticketmasterConnector } from "./sources/ticketmaster";
import { arenaMonterreyConnector } from "./sources/arena-monterrey";

// Agregar una fuente nueva = agregar una entrada aquí.
export const connectors: Connector[] = [
  ticketmasterConnector(),
  // API JSON del sitio de la Arena (su cartelera es SPA sin JSON-LD; el
  // pageConnector viejo daba 404). Cubre lo que vende Superboletos, que
  // Ticketmaster casi no trae de este venue.
  arenaMonterreyConnector(),
  // Auditorio Citibanamex se quitó (2026-07-23): Ticketmaster ya cubre ese
  // venue ("Auditorio Banamex") y el pageConnector solo vivía del fallback
  // LLM que nunca tuvo ANTHROPIC_API_KEY.
];
