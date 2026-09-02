import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TidyNext — AI Home Reset",
  description: "Fotografe a bagunça e receba um plano simples para organizar seu ambiente.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
