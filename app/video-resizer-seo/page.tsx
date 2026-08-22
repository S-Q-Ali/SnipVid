import { Metadata } from "next";
import SeoPage, { getToolSeo } from "@/lib/seo/tool-seo";

export default function VideoResizerSeoPage(): Metadata {
  const seo = getToolSeo("resize");
  return SeoPage({
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    ogImage: seo.ogImage,
    twitterCard: seo.twitterCard,
  });
}

/* SEO Content for Video Resizer Page */

/**
 * Video Resizer - Social Media Presets
 * 
 * YouTube: 1920×1080 (16:9)
 * YouTube Shorts: 1080×1920 (9:16)
 * TikTok: 1080×1920 (9:16)
 * Instagram Feed: 1080×1080 (1:1)
 * Instagram Stories: 1080×1350 (4:5)
 * Instagram Reels: 1080×1920 (9:16)
 * Facebook Feed: 1280×720 (16:9)
 * Twitter: 1280×720 (16:9)
 */

const socialMediaPresets = [
  { name: "YouTube", resolution: "1920×1080", ratio: "16:9", useCase: "Long-form video" },
  { name: "YouTube Shorts", resolution: "1080×1920", ratio: "9:16", useCase: "Vertical video" },
  { name: "TikTok", resolution: "1080×1920", ratio: "9:16", useCase: "Vertical video" },
  { name: "Instagram Feed", resolution: "1080×1080", ratio: "1:1", useCase: "Square post" },
  { name: "Instagram Stories", resolution: "1080×1350", ratio: "4:5", useCase: "Vertical story" },
  { name: "Instagram Reels", resolution: "1080×1920", ratio: "9:16", useCase: "Vertical video" },
  { name: "Facebook Feed", resolution: "1280×720", ratio: "16:9", useCase: "Long-form video" },
  { name: "Twitter", resolution: "1280×720", ratio: "16:9", useCase: "Long-form video" },
];

/**
 * Video Resizer - Aspect Ratio Maintenance
 * 
 * When resizing video, maintaining aspect ratio prevents distortion:
 * - Original: 1920×1080 (16:9)
 * - Target: 1080×1080 (1:1)
 * - Result: Video scaled to 1080×1080 with black bars (letterboxing)
 * 
 * Disabling aspect ratio maintenance stretches the video,
 * causing visual distortion and poor playback quality.
 */

/* End SEO Content */

export function generateMetadata(): Metadata {
  return VideoResizerSeoPage();
}