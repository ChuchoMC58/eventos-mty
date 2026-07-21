"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

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

  async function toggle() {
    setBusy(true);
    if (isSaved) {
      await fetch("/api/saved", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      setIsSaved(false);
    } else {
      // reminderPref: "always" → con recordatorio; "never" → sin; "ask" → preguntar
      const reminder =
        reminderPref === "always" ||
        (reminderPref === "ask" && window.confirm("¿Te recordamos por WhatsApp un día antes del evento?"));
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, reminder }),
      });
      if (res.status === 401) {
        router.push(`/entrar?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setIsSaved(true);
    }
    setBusy(false);
  }

  return (
    <button onClick={toggle} disabled={busy} className={`rounded-md border px-5 py-2.5 text-sm transition-colors disabled:opacity-60 ${isSaved ? "border-musica/50 font-bold text-musica" : "border-linea text-hueso hover:border-humo"}`}>
      {isSaved ? "★ Guardado" : "☆ Me interesa"}
    </button>
  );
}
