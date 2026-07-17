import EntrarForm from "@/components/EntrarForm";

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-1 text-2xl font-bold">Entrar</h1>
      <p className="mb-4 text-sm text-gray-500">
        Sin contraseñas: te mandamos un código por WhatsApp.
      </p>
      <EntrarForm next={next ?? "/"} />
    </main>
  );
}
