import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/duel`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/arena`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/bets`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
  ];
}
