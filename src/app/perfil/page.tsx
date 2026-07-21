import { getSessionUserId } from "@/lib/auth/session";
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
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-1 font-display text-3xl uppercase tracking-tight">
        {nuevo ? "¡Bienvenido! ¿Qué te gusta?" : "Mi perfil"}
      </h1>
      <p className="mb-5 text-sm text-humo">
        Con esto armamos tu resumen semanal de WhatsApp.
      </p>
      <PerfilForm next={next ?? "/"} />
    </main>
  );
}
