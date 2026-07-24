"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { mxNationalDigits } from "@/lib/auth/phone";

export default function EntrarForm({ next }: { next: string }) {
  const router = useRouter();
  const [nacional, setNacional] = useState(""); // solo los 10 dígitos; la lada +52 es fija
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const phone = `+52${nacional}`;

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
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al enviar el código");
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
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Código incorrecto");
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
            <div className="mt-1 flex">
              <span className="flex select-none items-center rounded-l-md border border-r-0 border-linea bg-ink-2 px-3 font-semibold text-hueso">
                +52
              </span>
              <input
                className="w-full rounded-r-md border border-linea bg-ink-2 p-2.5 outline-none transition-colors focus:border-musica"
                value={nacional}
                onChange={(e) => setNacional(mxNationalDigits(e.target.value).slice(0, 10))}
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="8187654321"
              />
            </div>
          </label>
          <button onClick={pedirCodigo} disabled={busy || nacional.length !== 10} className="w-full rounded-md bg-musica p-2.5 font-extrabold text-ink transition-[filter] hover:brightness-110 disabled:opacity-60">
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
