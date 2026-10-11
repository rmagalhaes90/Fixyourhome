import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TidyNext",
    short_name: "TidyNext",
    description: "Fotografe a bagunça e receba um plano simples para organizar.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7f4",
    theme_color: "#0c7b67",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
