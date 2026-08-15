import EntrarForm from "@/components/EntrarForm";
import { ROTULO } from "@/lib/ui";

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 pt-14 sm:px-6 sm:pt-20">
      <p className={ROTULO}>Acceso</p>
      <h1 className="mt-3 font-display text-[clamp(2rem,6.5vw,3rem)] uppercase leading-[1.04] tracking-[0.11em]">
        Entrar
      </h1>
      <p className="mt-3.5 border-b border-linea pb-5 text-sm leading-relaxed text-ceniza">
        Sin contraseñas: te mandamos un código por WhatsApp.
      </p>
      <div className="pt-5">
        <EntrarForm next={next ?? "/"} />
      </div>
    </main>
  );
}
