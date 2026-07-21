const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatDia(d: Date): string {
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function formatHora(d: Date): string {
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "pm" : "am";
  return `${h}:${min} ${ampm}`;
}

export function formatFecha(d: Date): string {
  return `${formatDia(d)} · ${formatHora(d)}`;
}

export function formatPrecio(min?: number | null, max?: number | null): string | null {
  if (min == null) return null;
  const f = (n: number) => `$${n.toLocaleString("es-MX")}`;
  return max != null && max !== min ? `${f(min)}–${f(max)}` : `desde ${f(min)}`;
}
