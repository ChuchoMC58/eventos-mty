"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EntrarForm({ next }: { next: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("+52");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pedirCodigo() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Error al enviar el código");
      return;
    }
    setStep("code");
  }

  async function verificar() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Código incorrecto");
      return;
    }
    const { isNew } = await res.json();
    router.push(isNew ? `/perfil?nuevo=1&next=${encodeURIComponent(next)}` : next);
  }

  return (
    <div className="space-y-3">
      {step === "phone" ? (
        <>
          <label className="block text-sm text-humo">
            Tu WhatsApp
            <input
              className="mt-1 w-full rounded-md border border-linea bg-ink-2 p-2.5 outline-none transition-colors focus:border-musica"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+528187654321"
            />
          </label>
          <button onClick={pedirCodigo} disabled={busy} className="w-full rounded-md bg-musica p-2.5 font-extrabold text-ink transition-[filter] hover:brightness-110 disabled:opacity-60">
            {busy ? "Enviando…" : "Mandarme el código"}
          </button>
        </>
      ) : (
        <>
          <label className="block text-sm text-humo">
            Código de 6 dígitos (llegó a {phone})
            <input
              className="mt-1 w-full rounded-md border border-linea bg-ink-2 p-2.5 outline-none transition-colors focus:border-musica"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <button onClick={verificar} disabled={busy} className="w-full rounded-md bg-musica p-2.5 font-extrabold text-ink transition-[filter] hover:brightness-110 disabled:opacity-60">
            {busy ? "Verificando…" : "Entrar"}
          </button>
          <button onClick={() => setStep("phone")} className="w-full text-sm text-humo transition-colors hover:text-hueso">
            Cambiar número
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
