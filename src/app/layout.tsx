import type { Metadata } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Anton: display de rótulo industrial, un solo peso. Va SÓLO en titulares y en
// el numeral del día — los títulos de los eventos siguen en Geist, que a 100
// filas se lee y Anton no.
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vibra MX — qué hacer en Monterrey",
  description: "Conciertos, deportes, cultura, tecnología y bienestar en Monterrey. Recibe cada semana los eventos que te interesan por WhatsApp.",
};

const enlaceNav =
  "font-mono text-[0.7rem] uppercase tracking-[0.16em] text-ceniza transition-colors hover:text-cal";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-senal focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-fierro"
        >
          Saltar al contenido
        </a>

        <header className="sticky top-0 z-30 border-b border-linea bg-fierro/85 backdrop-blur-md">
          <nav className="mx-auto flex w-full max-w-[1100px] items-center gap-5 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-baseline gap-1.5" aria-label="Vibra MX, inicio">
              <span className="font-display text-lg uppercase leading-none tracking-[0.01em]">
                Vibra
              </span>
              <span className="bg-senal px-1.5 pb-1 pt-0.5 font-display text-lg uppercase leading-none text-fierro">
                MX
              </span>
            </Link>
            <span className="flex-1" />
            <Link href="/mis-eventos" className={enlaceNav}>
              Mis eventos
            </Link>
            <Link href="/perfil" className={enlaceNav}>
              Perfil
            </Link>
          </nav>
        </header>

        <div id="contenido" className="flex-1">
          {children}
        </div>

        <footer className="mt-16 border-t border-linea">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-6 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ceniza sm:px-6">
            <span className="text-cal">Vibra MX</span>
            <span aria-hidden>—</span>
            <span>Monterrey, N.L.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
