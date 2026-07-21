"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIAS = [
  { valor: "musica", nombre: "🎵 Música y conciertos" },
  { valor: "deportes", nombre: "⚽ Deportes" },
  { valor: "cultura", nombre: "🎭 Cultura y teatro" },
];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function PerfilForm({ next }: { next: string }) {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [digestDay, setDigestDay] = useState<string>("4"); // jueves por defecto
  const [reminderPref, setReminderPref] = useState("ask");
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
      }
      setCargando(false);
    });
  }, []);

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
      <fieldset>
        <legend className="mb-1 font-semibold">Categorías que te interesan</legend>
        {CATEGORIAS.map((c) => (
          <label key={c.valor} className="block">
            <input
              type="checkbox"
              checked={categories.includes(c.valor)}
              onChange={(e) =>
                setCategories(
                  e.target.checked
                    ? [...categories, c.valor]
                    : categories.filter((x) => x !== c.valor),
                )
              }
            />{" "}
            {c.nombre}
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
          <option value="sin">No enviarme el resumen (baja)</option>
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

      <button onClick={guardar} disabled={guardando} className="w-full rounded-md bg-musica p-2.5 font-extrabold text-ink transition-[filter] hover:brightness-110 disabled:opacity-60">
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
