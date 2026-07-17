export interface DigestEvent {
  title: string;
  startsAt: Date;
  venueName: string;
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatEventLine(ev: DigestEvent): string {
  const d = ev.startsAt;
  return `• ${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} — ${ev.title} @ ${ev.venueName}`;
}

// Sin curación: se listan TODOS los que crucen. Si no caben en el límite de
// plantilla de WhatsApp (~1024), se listan los que quepan + "…y N más → link".
export function buildDigestMessage(
  events: DigestEvent[],
  opts: { webUrl: string; maxChars?: number },
): string | null {
  if (events.length === 0) return null;
  const max = opts.maxChars ?? 950;
  const header = `¡Hola! 👋 Estos eventos en Monterrey cruzan con tus gustos:\n\n`;
  const footer = `\n\nVer todos: ${opts.webUrl}\nResponde BAJA para dejar de recibir este resumen.`;
  const lines = events.map(formatEventLine);
  const overflowLine = (n: number) => `\n…y ${n} eventos más → ${opts.webUrl}`;

  const lengthWith = (n: number) =>
    header.length +
    lines.slice(0, n).join("\n").length +
    (n < lines.length ? overflowLine(lines.length - n).length : 0) +
    footer.length;

  let included = lines.length;
  while (included > 1 && lengthWith(included) > max) included--;

  return (
    header +
    lines.slice(0, included).join("\n") +
    (included < lines.length ? overflowLine(lines.length - included) : "") +
    footer
  );
}
