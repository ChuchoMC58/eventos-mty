"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIAS_EN_ORDEN } from "@/lib/events/categorias";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO, ROTULO } from "@/lib/ui";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/**
 * Dos letras, no una: con inicial sola hay dos M (martes/miércoles) y una S y
 * una D que se confunden al vuelo. El nombre completo va en el `aria-label`,
 * que es lo que oye un lector de pantalla.
 */
const DIAS_CORTOS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

/** Botón de día. `has-[:checked]` porque el radio real va oculto dentro. */
const DIA =
  "flex-1 cursor-pointer border border-linea bg-fierro-2 py-2.5 text-center font-mono text-[0.72rem] uppercase tracking-[0.08em] text-ceniza transition-colors hover:border-ceniza has-[:checked]:border-senal has-[:checked]:bg-senal has-[:checked]:font-bold has-[:checked]:text-fierro has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-senal";

/**
 * Encabezado de grupo. Comparte la versalita mono de `ROTULO` pero va en `cal`
 * (el rótulo de campo va en `ceniza`): sin esa diferencia de tono los dos
 * niveles se leen igual y el formulario vuelve a verse plano. El filete lo
 * separa del grupo anterior, así el aire entre secciones lo pone la raya y no
 * un hueco vacío.
 */
const GRUPO =
  "border-t border-linea pt-3.5 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-cal";

export default function PerfilForm({ next }: { next: string }) {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [digestDay, setDigestDay] = useState<string>("4"); // jueves por defecto
  // Qué día recuperar al destildar "no enviarme el resumen": sin esto, apagarlo
  // y volver a encenderlo devolvía siempre al jueves y se perdía la elección.
  const [ultimoDia, setUltimoDia] = useState<string>("4");
  const [reminderPref, setReminderPref] = useState("ask");
  const [optOut, setOptOut] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const todasLasCategorias = categories.length === CATEGORIAS_EN_ORDEN.length;
  const algunasCategorias = categories.length > 0 && !todasLasCategorias;

  // `indeterminate` no se puede poner por atributo, sólo por propiedad: sin
  // esto, un lector de pantalla anuncia "Todo, sin marcar" cuando en realidad
  // hay algunas marcadas, y el guion que se dibuja no le llega a nadie.
  const casillaTodo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (casillaTodo.current) casillaTodo.current.indeterminate = algunasCategorias;
  }, [algunasCategorias]);

  useEffect(() => {
    fetch("/api/me").then(async (res) => {
      if (res.ok) {
        const u = await res.json();
        setCategories(u.categories);
        setDigestDay(u.digestDay === null ? "sin" : String(u.digestDay));
        if (u.digestDay !== null) setUltimoDia(String(u.digestDay));
        setReminderPref(u.reminderPref);
        setOptOut(u.optOut);
      }
      setCargando(false);
    });
  }, []);

  // Reactivar se guarda solo, sin esperar al botón: quien viene a deshacer una
  // baja quiere ver el efecto ya, no descubrir que faltaba guardar.
  async function reactivar() {
    setGuardando(true);
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optOut: false }),
    });
    setOptOut(false);
    setGuardando(false);
  }

  async function guardar() {
    setGuardando(true);
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      // Sin `tags`: el esquema del PATCH lo tiene opcional, así que omitirlo
      // deja intactos los gustos ya guardados. Mandar `[]` los borraría.
      body: JSON.stringify({
        categories,
        digestDay: digestDay === "sin" ? null : Number(digestDay),
        reminderPref,
      }),
    });
    setGuardando(false);
    router.push(next);
  }

  if (cargando) {
    return <p className={`${ROTULO} py-6`}>Cargando…</p>;
  }

  return (
    <div className="space-y-7">
      {optOut && (
        <div className="border-l-2 border-alerta bg-alerta/10 p-4">
          <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em] text-alerta">
            Estás dado de baja de WhatsApp
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ceniza">
            No te mandamos ni el resumen semanal ni los recordatorios. Tus gustos siguen
            guardados, así que puedes seguir usando la app.
          </p>
          <button onClick={reactivar} disabled={guardando} className={`mt-4 ${BOTON_SECUNDARIO}`}>
            {guardando ? "Reactivando…" : "Volver a recibir mensajes"}
          </button>
        </div>
      )}

      {/* Estos campos son lo MISMO —cuándo llega el resumen semanal y qué
          lleva—, pero antes se presentaban como ajustes sueltos de la app.
          Nada fuera del digest lee `categories`: el único consumidor es
          `lib/digest/run.ts`. Agruparlos lo dice.

          El día va ARRIBA de las categorías (a pedido del usuario el
          2026-08-12): se elige una vez y no se vuelve a tocar, mientras que
          las categorías son la lista larga con la que se juega. */}
      <section>
        <h2 className={GRUPO}>Tu resumen semanal</h2>
        <p className="mt-2 text-sm leading-relaxed text-ceniza">
          Sólo esto decide qué eventos te llegan.
        </p>

        <div className="mt-3.5 space-y-3.5">
          {/* Ya no dice "Resumen semanal por WhatsApp": el encabezado del grupo
              lo dice, y repetirlo dejaba al campo sin explicar lo único que
              elige, que es el día.

              Y ya no es un desplegable: son siete opciones fijas y cortas, así
              que esconderlas tras dos clics no compraba nada — en fila se ven
              todas de un vistazo y se elige con uno. Radios de verdad (ocultos)
              en vez de <button>: el grupo se recorre con flechas y anuncia
              "opción 5 de 7" sin que haya que reimplementarlo. */}
          <fieldset>
            <legend className={`${ROTULO} mb-2`}>Qué día te llega</legend>
            <div className={`flex gap-1 ${digestDay === "sin" ? "opacity-45" : ""}`}>
              {DIAS.map((d, i) => (
                <label key={i} className={DIA} aria-label={`Cada ${d.toLowerCase()}`}>
                  <input
                    type="radio"
                    name="digestDay"
                    className="sr-only"
                    value={String(i)}
                    checked={digestDay === String(i)}
                    onChange={() => {
                      setDigestDay(String(i));
                      setUltimoDia(String(i));
                    }}
                  />
                  {DIAS_CORTOS[i]}
                </label>
              ))}
            </div>

            {/* Elegir un día vuelve a encender el envío solo, sin tener que
                destildar esto primero. */}
            <label className="mt-2.5 flex w-fit cursor-pointer items-center gap-2.5 text-sm text-ceniza">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={digestDay === "sin"}
                onChange={(e) => setDigestDay(e.target.checked ? "sin" : ultimoDia)}
              />
              <span
                aria-hidden
                className="flex h-4 w-4 shrink-0 items-center justify-center border border-ceniza text-[0.6rem] font-bold text-transparent transition-colors peer-checked:border-senal peer-checked:bg-senal peer-checked:text-fierro peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-senal"
              >
                ✓
              </span>
              No enviarme el resumen
            </label>
          </fieldset>

          <fieldset>
            <legend className={`${ROTULO} mb-2`}>Categorías que te interesan</legend>

            {/* "Todo" no es una categoría más ni un valor guardado aparte: es
                marcar las cinco. Guardarlo como estado propio (o como lista
                vacía) crearía un dato invisible que en la BD no se distingue de
                "no elegí nada", que es justo lo que significa lo contrario:
                silencio. Con las cinco marcadas, lo que se ve es lo que hay.

                Contrapartida a tener presente: si algún día se agrega una sexta
                categoría, quien tenga "Todo" NO la recibirá hasta volver aquí.
                Ese día hay que decidir si se les agrega por migración. */}
            <label
              className={`mb-1.5 flex w-full cursor-pointer items-center gap-3 border bg-fierro-2 px-3.5 py-2.5 text-sm transition-colors ${
                todasLasCategorias || algunasCategorias
                  ? "border-senal"
                  : "border-linea hover:border-ceniza"
              }`}
            >
              <input
                ref={casillaTodo}
                type="checkbox"
                className="peer sr-only"
                checked={todasLasCategorias}
                onChange={(e) =>
                  setCategories(e.target.checked ? CATEGORIAS_EN_ORDEN.map((c) => c.slug) : [])
                }
              />
              <span
                aria-hidden
                className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center border text-[0.65rem] font-bold transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-senal ${
                  todasLasCategorias
                    ? "border-senal bg-senal text-fierro"
                    : algunasCategorias
                      ? "border-senal text-senal"
                      : "border-ceniza text-transparent"
                }`}
              >
                {todasLasCategorias ? "✓" : "–"}
              </span>
              Todo
            </label>

            <div className="space-y-1">
              {CATEGORIAS_EN_ORDEN.map((c) => (
                <label
                  key={c.slug}
                  className="flex cursor-pointer items-center gap-3 border border-linea bg-fierro-2 px-3.5 py-2.5 text-sm transition-colors hover:border-ceniza has-[:checked]:border-senal"
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={categories.includes(c.slug)}
                    onChange={(e) =>
                      setCategories(
                        e.target.checked
                          ? [...categories, c.slug]
                          : categories.filter((x) => x !== c.slug),
                      )
                    }
                  />
                  {/* La casilla es el hermano DIRECTO del input: `peer-checked` sólo
                      alcanza hermanos, así que el palomeo vive aquí (transparente
                      cuando no está marcado) y no en un span anidado. */}
                  <span
                    aria-hidden
                    className="flex h-4.5 w-4.5 shrink-0 items-center justify-center border border-ceniza text-[0.65rem] font-bold text-transparent transition-colors peer-checked:border-senal peer-checked:bg-senal peer-checked:text-fierro peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-senal"
                  >
                    ✓
                  </span>
                  {c.nombreLargo}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Aquí abajo iba "Gustos específicos" (el campo de tags). Se quitó de
              la interfaz el 2026-08-12 porque prometía lo que no podía cumplir:
              decía "equipos, géneros, artistas" pero el match sólo compara
              contra `event.tags`, nunca contra el título, y esos tags vienen
              del género de Ticketmaster y de las categorías de Luma — puro
              `rock`/`latin`/`comedy`, ni un nombre de banda o de equipo, y sólo
              el 31% de los eventos trae alguno. Escribir "rayados" o "molotov"
              no devolvía NADA, ni siquiera su propio partido o concierto.

              La columna sigue en la BD y el digest la sigue leyendo: a quien ya
              guardó gustos le siguen funcionando. Por eso `guardar()` no manda
              `tags` — mandarlo vacío los borraría. */}
        </div>
      </section>

      <section>
        <h2 className={GRUPO}>Recordatorios</h2>
        {/* Sin párrafo bajo el encabezado, a diferencia del grupo de arriba: allá
            explica algo que no se ve (que las categorías sólo alimentan el
            resumen), aquí sólo repetiría el rótulo del campo. */}
        <label className="mt-3.5 block">
          <span className={ROTULO}>Avisarme antes de un evento guardado</span>
          <select
            className={`${CAMPO} mt-2 w-full`}
            value={reminderPref}
            onChange={(e) => setReminderPref(e.target.value)}
          >
            <option value="ask">Preguntarme cada vez</option>
            <option value="always">Siempre recordarme</option>
            <option value="never">Nunca recordarme</option>
          </select>
        </label>
      </section>

      {/* La baja existía desde antes pero no se anunciaba en ningún lado: un
          opt-out que nadie sabe que existe no cuenta como opt-out, y Meta lo
          exige para las plantillas de marketing. */}
      {!optOut && (
        <p className="border-t border-linea pt-3.5 text-sm leading-relaxed text-ceniza">
          ¿Ya no quieres nada por WhatsApp? Responde{" "}
          <strong className="font-mono uppercase tracking-[0.12em] text-cal">BAJA</strong> a
          cualquiera de nuestros mensajes y dejamos de escribirte — resumen y recordatorios.
        </p>
      )}

      <button onClick={guardar} disabled={guardando} className={`w-full ${BOTON_PRIMARIO}`}>
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
