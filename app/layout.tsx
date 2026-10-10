import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TidyNext — AI Home Reset",
  description: "Fotografe a bagunça e receba um plano simples para organizar seu ambiente.",
  applicationName: "TidyNext",
  appleWebApp: {
    capable: true,
    title: "TidyNext",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c7b67",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
