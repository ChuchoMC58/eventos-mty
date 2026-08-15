import { Connector } from "./connector";
import { ticketmasterConnector } from "./sources/ticketmaster";
import { arenaMonterreyConnector } from "./sources/arena-monterrey";
import { conarteConnector } from "./sources/conarte";
import { lumaConnector } from "./sources/luma";
import { superboletosConnector } from "./sources/superboletos";
import { aremaConnector } from "./sources/arema";
import { feverConnector } from "./sources/fever";
import { tigresConnector } from "./sources/tigres";
import { marcoConnector } from "./sources/marco";
import { culturaUanlConnector } from "./sources/cultura-uanl";

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
  // Tigres NO está en Ticketmaster: su Estadio Universitario da 0 eventos ahí,
  // aunque Rayados sí entre por la consulta geográfica. Su calendario lo pinta un
  // componente de terceros sobre una API JSON con la liga entera; se filtran los
  // partidos de local. Son 7 por torneo, pero son los eventos más grandes de la
  // ciudad junto con los de Rayados.
  tigresConnector(),
  // El museo privado grande de la ciudad, que no cubre nadie más: CONARTE es
  // cultura del estado y Fever no vende sus actividades. Su WordPress expone una
  // REST API que NO sirve (acf y content vacíos, igual que la de CONARTE), así
  // que se parsea el HTML del listado, que agrupa por día.
  marcoConnector(),
  // El programa cultural de la universidad pública: Colegio Civil CCU, Sala
  // Fósforo, Capilla Alfonsina y el Teatro Universitario de Mederos. Casi todo
  // de entrada libre, que es justo lo que no vende ninguna boletera y lo que
  // CONARTE no cubre por ser cultura del estado y no de la UANL. Su WordPress
  // usa The Events Calendar, cuya REST API sí trae sede, hora y costo — al revés
  // que la REST API estándar de WordPress, que en CONARTE y MARCO no sirve.
  culturaUanlConnector(),
  // Auditorio Citibanamex se quitó (2026-07-23): Ticketmaster ya cubre ese
  // venue ("Auditorio Banamex") y el pageConnector solo vivía del fallback
  // LLM que nunca tuvo ANTHROPIC_API_KEY.
];
