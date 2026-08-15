"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { mxNationalDigits } from "@/lib/auth/phone";
import { BOTON_PRIMARIO, CAMPO, ROTULO } from "@/lib/ui";

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
    <div className="space-y-4">
      {step === "phone" ? (
        <>
          <label className="block">
            <span className={ROTULO}>Tu WhatsApp</span>
            <div className="mt-2.5 flex">
              {/* La lada fija es pieza de diseño, no un input: se lee como el
                  prefijo estampado de un tablero. */}
              <span className="flex select-none items-center border border-r-0 border-linea bg-fierro-2 px-3.5 font-mono text-sm tabular-nums text-ceniza">
                +52
              </span>
              <input
                className={`${CAMPO} w-full border-l-0 font-mono tabular-nums`}
                value={nacional}
                onChange={(e) => setNacional(mxNationalDigits(e.target.value).slice(0, 10))}
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="8187654321"
              />
            </div>
          </label>
          <button
            onClick={pedirCodigo}
            disabled={busy || nacional.length !== 10}
            className={`w-full ${BOTON_PRIMARIO}`}
          >
            {busy ? "Enviando…" : "Mandarme el código"}
          </button>
        </>
      ) : (
        <>
          <label className="block">
            <span className={ROTULO}>Código de 6 dígitos</span>
            <span className="mt-1.5 block font-mono text-sm tabular-nums text-ceniza">
              Llegó a {phone}
            </span>
            {/* Se filtra en el onChange y no sólo con `maxLength`: pegar un
                código con espacios o de 7 dígitos entraba tal cual, y el
                servidor lo rechazaba como "incorrecto" sin decir por qué. */}
            <input
              className={`${CAMPO} mt-2.5 w-full text-center font-mono text-2xl tabular-nums tracking-[0.4em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
            />
          </label>
          <button
            onClick={verificar}
            disabled={busy || code.length !== 6}
            className={`w-full ${BOTON_PRIMARIO}`}
          >
            {busy ? "Verificando…" : "Entrar"}
          </button>
          <button
            onClick={() => setStep("phone")}
            className="w-full py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ceniza transition-colors hover:text-cal"
          >
            Cambiar número
          </button>
        </>
      )}
      {error && (
        <p className="border-l-2 border-alerta bg-alerta/10 px-3.5 py-2.5 text-sm text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}
