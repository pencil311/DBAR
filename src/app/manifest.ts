import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DBar",
    short_name: "DBar",
    description: "County Attendance Register",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e8dcc4",
    theme_color: "#2b1d12",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
