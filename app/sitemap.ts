import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://videotoolkit.app";

  const routes = [
    "",
    "/video-downloader",
    "/video-converter",
    "/video-to-mp4",
    "/mpeg-4-to-mp4",
    "/mov-to-mp4",
    "/mkv-to-mp4",
    "/webm-to-mp4",
    "/avi-to-mp4",
    "/video-to-mp3",
    "/video-compressor",
    "/video-resizer",
    "/video-trimmer",
    "/video-cropper",
    "/video-to-gif",
    "/rotate-video",
    "/social-video-converter",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.8,
  }));
}