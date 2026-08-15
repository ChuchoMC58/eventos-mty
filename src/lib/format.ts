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

const CIUDADES: Record<string, string> = { monterrey: "Monterrey" };
const CONECTORES = new Set(["de", "del", "la", "las", "los", "y"]);

/**
 * Nombre presentable de la ciudad a partir del slug que guarda la BD
 * ("monterrey" → "Monterrey"). Hoy sólo existe Monterrey, pero el digest ya
 * manda la ciudad como variable de la plantilla, y una plantilla aprobada no se
 * puede editar: si mañana entra otra ciudad tiene que salir bien sin tocar Meta.
 *
 * El fallback deja los conectores en minúscula ("ciudad-de-mexico" → "Ciudad de
 * México" y no "Ciudad De México"). Para nombres con acento que el slug no trae,
 * agregar la entrada al mapa.
 */
export function nombreCiudad(slug: string): string {
  const conocida = CIUDADES[slug];
  if (conocida) return conocida;
  return slug
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && CONECTORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/**
 * Frase de tiempo para el recordatorio de WhatsApp: "hoy a las 9:00 pm",
 * "mañana a las 9:00 pm", "el jue 30 jul a las 9:00 pm".
 *
 * Existe porque el cuerpo de una plantilla aprobada por Meta es FIJO: si el
 * texto trae "Mañana es …" escrito a mano, deja de ser cierto en cuanto el
 * cron deje de mirar sólo el día siguiente (el plan es ventana de 12–36 h), y
 * corregirlo obliga a crear otra plantilla y volver a pasar por revisión.
 * Metiendo la palabra "hoy/mañana" dentro de la variable, el mismo texto
 * aprobado sirve para cualquier ventana.
 *
 * Compara DÍAS DE CALENDARIO, no horas transcurridas: a las 11 pm del miércoles
 * un evento del viernes no es "mañana" aunque falten 34 h. El precio de esta
 * regla es que un evento a la 1 am se anuncia como "mañana" estando a 2 h; se
 * prefiere eso a decir "hoy" de una fecha que no es la de hoy.
 */
export function formatCuando(d: Date, now: Date = new Date()): string {
  const medianoche = (x: Date) => new Date(x).setHours(0, 0, 0, 0);
  const dias = Math.round((medianoche(d) - medianoche(now)) / 86_400_000);
  // "a la 1:00 am" / "a las 9:00 pm": la una va en singular.
  const aLas = `a ${d.getHours() % 12 === 1 ? "la" : "las"} ${formatHora(d)}`;
  if (dias === 0) return `hoy ${aLas}`;
  if (dias === 1) return `mañana ${aLas}`;
  return `el ${formatDia(d)} ${aLas}`;
}

export function formatPrecio(min?: number | null, max?: number | null): string | null {
  if (min == null) return null;
  const f = (n: number) => `$${n.toLocaleString("es-MX")}`;
  // 0 es un precio real, no un dato faltante: CONARTE y Luma traen eventos de
  // entrada libre y "$0" se lee como un error de la app.
  if (min === 0 && (max == null || max === 0)) return "Gratis";
  return max != null && max !== min ? `${f(min)}–${f(max)}` : `desde ${f(min)}`;
}
