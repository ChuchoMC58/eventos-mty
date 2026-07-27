export interface CalendarEvent {
  id?: string; // se usa como UID del .ics; Outlook lo exige para abrir el evento
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  venueName: string;
  address?: string | null;
  description?: string | null;
}

const fmtUtc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const finDe = (ev: CalendarEvent) => ev.endsAt ?? new Date(ev.startsAt.getTime() + 2 * 60 * 60 * 1000);

export function googleCalendarUrl(ev: CalendarEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${fmtUtc(ev.startsAt)}/${fmtUtc(finDe(ev))}`,
    location: [ev.venueName, ev.address].filter(Boolean).join(", "),
    details: ev.description ?? "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

// URL `intent://` de Android: hace que el MISMO link web de Google Calendar lo
// abra la APP nativa (`package=com.google.android.calendar`) en vez del navegador,
// con el evento prellenado y listo para guardar.
//
// Por qué así y no con `ACTION_INSERT` (el camino "obvio", ya descartado en device):
// Chrome solo lanza actividades que declaran `android.intent.category.BROWSABLE`
// (https://developer.chrome.com/docs/android/intents), y la pantalla de "nuevo
// evento" de Google Calendar no la declara — el intent nunca resolvía y SIEMPRE
// caía al fallback web. El deep link `VIEW` sí resuelve porque la app maneja las
// URLs de `calendar.google.com`.
//
// `browser_fallback_url` cubre el Android sin la app instalada (o el navegador que
// no soporte `intent://`): en vez de una página de error, el formulario web.
// Solo tiene sentido en Android; en iOS/desktop se usa `googleCalendarUrl`.
export function androidCalendarIntentUrl(ev: CalendarEvent): string {
  const web = googleCalendarUrl(ev);
  const extras = [
    "scheme=https",
    "package=com.google.android.calendar",
    "action=android.intent.action.VIEW",
    `S.browser_fallback_url=${encodeURIComponent(web)}`,
    "end",
  ];
  return `intent://${web.replace(/^https:\/\//, "")}#Intent;${extras.join(";")}`;
}

export function buildIcs(ev: CalendarEvent): string {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const uid = `${ev.id ?? fmtUtc(ev.startsAt)}@eventos-mty`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//eventos-mty//ES",
    // METHOD:PUBLISH + UID hacen que Outlook abra el evento para guardarlo
    // (sin ellos solo abre la app o lo importa en silencio).
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(ev.startsAt)}`,
    `DTEND:${fmtUtc(finDe(ev))}`,
    `SUMMARY:${esc(ev.title)}`,
    `LOCATION:${esc([ev.venueName, ev.address ?? ""].filter(Boolean).join(", "))}`,
    // Recordatorio 2 h antes (Apple/Outlook/Google respetan VALARM al importar el .ics).
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(ev.title)}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
