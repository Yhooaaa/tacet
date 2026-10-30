import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/scan`, changeFrequency: "monthly", priority: 0.9 },
    ...["privacy", "terms", "cookies", "security"].map((page) => ({ url: `${SITE_URL}/${page}`, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
