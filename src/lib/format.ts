const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatFecha(d: Date): string {
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "pm" : "am";
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} · ${h}:${min} ${ampm}`;
}

export function formatPrecio(min?: number | null, max?: number | null): string | null {
  if (min == null) return null;
  return max != null && max !== min ? `$${min}–$${max}` : `desde $${min}`;
}
