import { Metadata } from "next";
import SeoPage, { getToolSeo } from "@/lib/seo/tool-seo";

export default function VideoToGifSeoPage(): Metadata {
  const seo = getToolSeo("gif");
  return SeoPage({
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    ogImage: seo.ogImage,
    twitterCard: seo.twitterCard,
  });
}

/* SEO Content for GIF Creator Page */

/**
 * GIF Creator - Optimized GIF Creation
 * 
 * Creating optimized GIFs from videos involves balancing quality and file size:
 * 
 * FPS (Frames Per Second):
 * - 10-15 FPS: Small GIFs, suitable for simple animations
 * - 15-20 FPS: Good quality, moderate file size
 * - 20-30 FPS: High quality, larger file size
 * 
 * Width:
 * - 360px: Small GIFs, fast loading
 * - 480px: Medium GIFs, good quality
 * - 720px: Large GIFs, high quality, larger files
 * 
 * Quality Optimization:
 * - Limit the number of colors (quantization) - fewer colors = smaller file
 * - Reduce duration - shorter GIFs = smaller files
 * - Optimize palette - custom palettes improve quality at smaller sizes
 * 
 * Typical Use Cases:
 * - Reaction GIFs: 3-5 seconds, 15-20 FPS, 480px width
 * - Video highlights: 5-10 seconds, 20-25 FPS, 720px width
 * - Short clips: 3-6 seconds, 15 FPS, 480px width
 * 
 * File Size Guidelines:
 * - Small (< 1 MB): Quick reactions, short clips
 * - Medium (1-5 MB): Moderate length, good quality
 * - Large (5-15 MB): High quality, longer clips
 * - Avoid > 15 MB as GIFs can be very large compared to MP4/video
 */

/* End SEO Content */

export function generateMetadata(): Metadata {
  return VideoToGifSeoPage();
}