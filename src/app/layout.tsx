import type { Metadata } from "next";
import { Archivo_Black, Geist, Geist_Mono } from "next/font/google";
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

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eventos MTY — qué hacer en Monterrey",
  description: "Conciertos, deportes y cultura en Monterrey. Recibe cada semana los eventos que te interesan por WhatsApp.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-linea bg-ink/85 backdrop-blur-md">
          <nav className="mx-auto flex w-full max-w-3xl items-baseline gap-5 px-4 py-3.5 text-sm">
            <Link href="/" className="font-display uppercase tracking-[0.08em]">
              Eventos <span className="text-musica">MTY</span>
            </Link>
            <span className="flex-1" />
            <Link href="/mis-eventos" className="text-humo transition-colors hover:text-hueso">
              Mis eventos
            </Link>
            <Link href="/perfil" className="text-humo transition-colors hover:text-hueso">
              Mi perfil
            </Link>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-linea">
          <p className="mx-auto max-w-3xl px-4 py-5 text-xs text-humo">
            Eventos MTY · Monterrey, N.L.
          </p>
        </footer>
      </body>
    </html>
  );
}
