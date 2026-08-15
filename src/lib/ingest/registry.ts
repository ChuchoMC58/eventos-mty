import { Connector } from "./connector";
import { ticketmasterConnector } from "./sources/ticketmaster";
import { arenaMonterreyConnector } from "./sources/arena-monterrey";
import { conarteConnector } from "./sources/conarte";
import { lumaConnector } from "./sources/luma";
import { superboletosConnector } from "./sources/superboletos";
import { aremaConnector } from "./sources/arema";
import { feverConnector } from "./sources/fever";

// Agregar una fuente nueva = agregar una entrada aquí.
export const connectors: Connector[] = [
  ticketmasterConnector(),
  // API JSON del sitio de la Arena (su cartelera es SPA sin JSON-LD; el
  // pageConnector viejo daba 404). Cubre lo que vende Superboletos, que
  // Ticketmaster casi no trae de este venue.
  arenaMonterreyConnector(),
  // Las dos fuentes de abajo aportan poco volumen (~5 eventos cada una) pero
  // traen lo que ninguna boletera puede tener: eventos culturales gratuitos y
  // shows de venue chico. Son scraping/API no documentada, así que llevan
  // minExpected bajo y detección propia de "ya no sé leer la fuente".
  conarteConnector(),
  lumaConnector(),
  // La boletera que surte a Showcenter Complex y Dion Live Center, venues que
  // ninguna otra fuente nuestra ve. Un solo JSON en CloudFront con el catálogo
  // nacional; ~49 de sus eventos de NL son de Arena Monterrey y se fusionan con
  // los de Ticketmaster y el conector de la Arena por nombre de venue idéntico.
  superboletosConnector(),
  // La boletera de los venues chicos del área metropolitana: Auditorio Río 70,
  // Café Iguana, Jardín 85, los Zagar Comedy Bar y el Teatro de la Ciudad. Es
  // la única fuente con masa de comedia, y trae ~96 eventos de NL que sólo se
  // cruzan con las demás en Café Iguana y Pabellón M.
  aremaConnector(),
  // La única fuente que NO es boletera de conciertos: Candlelight, experiencias
  // inmersivas, museos y juegos callejeros. Cero solape con las demás —ni un
  // venue compartido— y es lo que le da a la cartelera algo que hacer entre
  // semana. Dos etapas: la home de la ciudad da los ids y la página de cada plan
  // da las funciones de verdad.
  feverConnector(),
  // Auditorio Citibanamex se quitó (2026-07-23): Ticketmaster ya cubre ese
  // venue ("Auditorio Banamex") y el pageConnector solo vivía del fallback
  // LLM que nunca tuvo ANTHROPIC_API_KEY.
];
