import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b">
          <nav className="mx-auto flex max-w-3xl gap-4 p-3 text-sm">
            <a href="/" className="font-bold">Eventos MTY</a>
            <a href="/mis-eventos">Mis eventos</a>
            <a href="/perfil">Mi perfil</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
