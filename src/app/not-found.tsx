import Link from "next/link";
import { BOTON_PRIMARIO, ROTULO } from "@/lib/ui";

/**
 * `notFound()` se llama desde el detalle de evento y desde /admin/salud. Sin
 * este archivo, ambos caían en la página por defecto de Next: fondo blanco,
 * Helvetica y "This page could not be found" en inglés, fuera del diseño y del
 * idioma de la app.
 */
export default function NoEncontrado() {
  return (
    <main className="mx-auto flex max-w-[960px] flex-col items-start px-4 pt-20 sm:px-6 sm:pt-28">
      <p className={ROTULO}>Error 404</p>
      <p className="mt-4 font-display text-[clamp(4.5rem,18vw,10rem)] leading-[0.82] tracking-[-0.01em] text-cal/10 tabular-nums">
        404
      </p>
      <h1 className="-mt-6 font-display text-[clamp(2rem,6.5vw,3.2rem)] uppercase leading-[1.04] tracking-[0.11em] text-balance">
        Esto no está
        <br />
        en la cartelera<span className="-ml-[0.11em] text-senal">.</span>
      </h1>
      <p className="mt-4 max-w-sm leading-relaxed text-ceniza">
        La página que buscas no existe, o el evento ya salió de cartelera.
      </p>
      <Link href="/" className={`mt-8 ${BOTON_PRIMARIO}`}>
        Ver qué hay en Monterrey
      </Link>
    </main>
  );
}
