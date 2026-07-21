import EntrarForm from "@/components/EntrarForm";

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-8">
      <h1 className="mb-1 font-display text-3xl uppercase tracking-tight">Entrar</h1>
      <p className="mb-5 text-sm text-humo">
        Sin contraseñas: te mandamos un código por WhatsApp.
      </p>
      <EntrarForm next={next ?? "/"} />
    </main>
  );
}
