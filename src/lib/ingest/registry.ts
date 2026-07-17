import { Connector } from "./connector";
import { ticketmasterConnector } from "./sources/ticketmaster";
import { pageConnector } from "./page-connector";

// Agregar una fuente nueva = agregar una entrada aquí.
// Las URLs se confirman al implementar (inspeccionar cada página: ¿trae JSON-LD?).
export const connectors: Connector[] = [
  ticketmasterConnector(),
  pageConnector({
    slug: "arena-monterrey",
    name: "Arena Monterrey",
    url: "https://www.arenamonterrey.com/eventos",
    category: "musica",
    llmFallback: true,
  }),
  pageConnector({
    slug: "auditorio-citibanamex",
    name: "Auditorio Citibanamex",
    url: "https://www.auditoriocitibanamex.com/eventos",
    category: "musica",
    llmFallback: true,
  }),
];
