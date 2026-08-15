"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIAS_EN_ORDEN } from "@/lib/events/categorias";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function PerfilForm({ next }: { next: string }) {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [digestDay, setDigestDay] = useState<string>("4"); // jueves por defecto
  const [reminderPref, setReminderPref] = useState("ask");
  const [optOut, setOptOut] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/me").then(async (res) => {
      if (res.ok) {
        const u = await res.json();
        setCategories(u.categories);
        setTags(u.tags.join(", "));
        setDigestDay(u.digestDay === null ? "sin" : String(u.digestDay));
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
      body: JSON.stringify({
        categories,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        digestDay: digestDay === "sin" ? null : Number(digestDay),
        reminderPref,
      }),
    });
    setGuardando(false);
    router.push(next);
  }

  if (cargando) return <p>Cargando…</p>;

  return (
    <div className="space-y-4">
      {optOut && (
        <div className="rounded-md border border-linea bg-ink-2 p-3">
          <p className="font-semibold">Estás dado de baja de WhatsApp</p>
          <p className="mt-1 text-sm text-humo">
            No te mandamos ni el resumen semanal ni los recordatorios. Tus gustos siguen
            guardados, así que puedes seguir usando la app.
          </p>
          <button
            onClick={reactivar}
            disabled={guardando}
            className="mt-2 rounded-md border border-linea px-3 py-1.5 text-sm font-semibold transition-colors hover:border-musica disabled:opacity-60"
          >
            {guardando ? "Reactivando…" : "Volver a recibir mensajes"}
          </button>
        </div>
      )}

      <fieldset>
        <legend className="mb-1 font-semibold">Categorías que te interesan</legend>
        {CATEGORIAS_EN_ORDEN.map((c) => (
          <label key={c.slug} className="block">
            <input
              type="checkbox"
              checked={categories.includes(c.slug)}
              onChange={(e) =>
                setCategories(
                  e.target.checked
                    ? [...categories, c.slug]
                    : categories.filter((x) => x !== c.slug),
                )
              }
            />{" "}
            {c.nombreLargo}
          </label>
        ))}
      </fieldset>

      <label className="block">
        <span className="font-semibold">Gustos específicos</span>
        <span className="block text-sm text-humo">
          Equipos, géneros, artistas — separados por comas
        </span>
        <input
          className="mt-1 w-full rounded-md border border-linea bg-ink-2 p-2.5 outline-none transition-colors focus:border-musica"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="rayados, rock, stand-up"
        />
      </label>

      <label className="block">
        <span className="font-semibold">Resumen semanal por WhatsApp</span>
        <select
          className="mt-1 w-full rounded-md border border-linea bg-ink-2 p-2.5 outline-none transition-colors focus:border-musica"
          value={digestDay}
          onChange={(e) => setDigestDay(e.target.value)}
        >
          {DIAS.map((d, i) => (
            <option key={i} value={String(i)}>
              Cada {d.toLowerCase()}
            </option>
          ))}
          <option value="sin">No enviarme el resumen</option>
        </select>
      </label>

      <label className="block">
        <span className="font-semibold">Recordatorios de eventos guardados</span>
        <select
          className="mt-1 w-full rounded-md border border-linea bg-ink-2 p-2.5 outline-none transition-colors focus:border-musica"
          value={reminderPref}
          onChange={(e) => setReminderPref(e.target.value)}
        >
          <option value="ask">Preguntarme cada vez</option>
          <option value="always">Siempre recordarme</option>
          <option value="never">Nunca recordarme</option>
        </select>
      </label>

      {/* La baja existía desde antes pero no se anunciaba en ningún lado: un
          opt-out que nadie sabe que existe no cuenta como opt-out, y Meta lo
          exige para las plantillas de marketing. */}
      {!optOut && (
        <p className="text-sm text-humo">
          ¿Ya no quieres nada por WhatsApp? Responde{" "}
          <strong className="text-hueso">BAJA</strong> a cualquiera de nuestros mensajes y
          dejamos de escribirte — resumen y recordatorios.
        </p>
      )}

      <button onClick={guardar} disabled={guardando} className="w-full rounded-md bg-musica p-2.5 font-extrabold text-ink transition-[filter] hover:brightness-110 disabled:opacity-60">
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
