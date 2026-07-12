import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Futcaster — call it before kickoff",
    short_name: "Futcaster",
    description:
      "Free football prediction game on real matches with real odds. Ranked 1v1 duels, friends leagues, zero real money.",
    start_url: "/",
    display: "standalone",
    background_color: "#140e33",
    theme_color: "#140e33",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
