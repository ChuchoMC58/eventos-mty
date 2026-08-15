"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from "@/lib/ui";

export default function SaveButton({
  eventId,
  saved,
  reminderPref,
}: {
  eventId: string;
  saved: boolean;
  reminderPref: string | null; // null = sin sesión
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSaved, setIsSaved] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [preguntando, setPreguntando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const siRef = useRef<HTMLButtonElement>(null);

  // Esc cierra el diálogo guardando SIN recordatorio, igual que el "No" — así el
  // clic en "Me interesa" nunca se pierde en silencio.
  useEffect(() => {
    if (!preguntando) return;
    siRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") guardar(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preguntando]);

  async function guardar(reminder: boolean) {
    setPreguntando(false);
    setError(null);
    setBusy(true);
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, reminder }),
    });
    if (res.status === 401) {
      router.push(`/entrar?next=${encodeURIComponent(pathname)}`);
      return;
    }
    // Sin esto el botón se marcaba como guardado aunque el servidor fallara, y el
    // evento desaparecía al recargar sin que el usuario se enterara.
    if (!res.ok) {
      setError("No pudimos guardarlo. Intenta de nuevo.");
      setBusy(false);
      return;
    }
    setIsSaved(true);
    setBusy(false);
    // Sin esto, la caché de router del cliente sigue sirviendo el RSC viejo: sales
    // a "Mis eventos", regresas, y el botón aparece con el estado anterior.
    router.refresh();
  }

  async function quitar() {
    setBusy(true);
    await fetch("/api/saved", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    setIsSaved(false);
    setBusy(false);
    router.refresh(); // invalida la caché de router (detalle y "Mis eventos")
  }

  function alClic() {
    if (isSaved) return quitar();
    // reminderPref: "always" → con recordatorio; "never" → sin; "ask" → preguntar.
    // Sin sesión (null) el POST responde 401 y mandamos a /entrar.
    if (reminderPref === "ask") return setPreguntando(true);
    guardar(reminderPref === "always");
  }

  return (
    <>
      <button
        onClick={alClic}
        disabled={busy}
        className={
          isSaved
            ? "border border-senal px-5 py-3 font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-senal transition-colors disabled:opacity-60"
            : BOTON_SECUNDARIO
        }
      >
        {isSaved ? "★ Guardado" : "☆ Me interesa"}
      </button>
      {error && <span className="self-center text-sm text-alerta">{error}</span>}

      {/* Diálogo propio en vez de window.confirm: el nativo rotula los botones
          "OK/Cancel" en el idioma del navegador y no se pueden cambiar. */}
      {preguntando && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-recordatorio"
          className="fixed inset-0 z-50 flex items-center justify-center bg-fierro/85 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) guardar(false);
          }}
        >
          <div className="w-full max-w-sm border border-linea bg-fierro-2 p-6">
            <p id="titulo-recordatorio" className="text-lg font-bold leading-snug tracking-[0.01em]">
              ¿Te recordamos por WhatsApp un día antes del evento?
            </p>
            <p className="mt-2 text-sm text-ceniza">
              El evento se guarda en “Mis eventos” de cualquier forma.
            </p>
            <div className="mt-6 flex gap-2.5">
              <button ref={siRef} onClick={() => guardar(true)} className={`flex-1 ${BOTON_PRIMARIO}`}>
                Sí
              </button>
              <button onClick={() => guardar(false)} className={`flex-1 ${BOTON_SECUNDARIO}`}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
