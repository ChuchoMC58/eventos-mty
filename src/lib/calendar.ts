export interface CalendarEvent {
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

export function buildIcs(ev: CalendarEvent): string {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//eventos-mty//ES",
    "BEGIN:VEVENT",
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
