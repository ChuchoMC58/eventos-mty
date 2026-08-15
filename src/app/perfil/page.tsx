import { getSessionUserId } from "@/lib/auth/session";
import { ROTULO } from "@/lib/ui";
import { redirect } from "next/navigation";
import PerfilForm from "@/components/PerfilForm";

export default async function Perfil({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string; next?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/entrar?next=/perfil");
  const { nuevo, next } = await searchParams;
  return (
    <main className="mx-auto max-w-lg px-4 pt-12 sm:px-6 sm:pt-16">
      <p className={ROTULO}>{nuevo ? "Bienvenido" : "Tu cuenta"}</p>
      <h1 className="mt-3 font-display text-[clamp(2rem,6.5vw,3rem)] uppercase leading-[1.04] tracking-[0.11em] text-balance">
        {nuevo ? "¿Qué te gusta?" : "Mi perfil"}
      </h1>
      <p className="mt-3.5 border-b border-linea pb-5 text-sm leading-relaxed text-ceniza">
        Qué te mandamos por WhatsApp, y cuándo.
      </p>
      <div className="pt-5">
        <PerfilForm next={next ?? "/"} />
      </div>
    </main>
  );
}
