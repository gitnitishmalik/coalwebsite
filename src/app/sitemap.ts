import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return ["", "/prices", "/benchmarks", "/insights", "/methodology"].map((p) => ({
    url: base + p,
    changeFrequency: p === "/methodology" ? "monthly" : "weekly",
    priority: p === "" ? 1 : 0.8,
  }));
}
