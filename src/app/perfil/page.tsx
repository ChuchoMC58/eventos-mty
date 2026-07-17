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
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-1 text-2xl font-bold">
        {nuevo ? "¡Bienvenido! ¿Qué te gusta?" : "Mi perfil"}
      </h1>
      <p className="mb-4 text-sm text-gray-500">
        Con esto armamos tu resumen semanal de WhatsApp.
      </p>
      <PerfilForm next={next ?? "/"} />
    </main>
  );
}
