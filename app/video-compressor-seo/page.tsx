import { Metadata } from "next";
import SeoPage, { getToolSeo } from "@/lib/seo/tool-seo";

export default function VideoCompressorSeoPage(): Metadata {
  const seo = getToolSeo("compress");
  return SeoPage({
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    ogImage: seo.ogImage,
    twitterCard: seo.twitterCard,
  });
}

/* SEO Content for Video Compressor Page */

/**
 * Video Compression - CRF Scale
 * 
 * CRF (Constant Rate Factor) controls video quality:
 * - 13-17: Excellent quality, larger files
 * - 18-22: Very good quality, moderate files (recommended)
 * - 23-28: Good quality, smaller files
 * - 29-31: Acceptable quality, smallest files
 * - 32-51: Poor quality, avoid
 * 
 * Default: 23 (Good balance of quality and size)
 */

/**
 * Video Compression - Bitrate vs CRF
 * 
 * CRF controls quality (constant quality throughout the video)
 * Bitrate controls file size (constant data rate)
 * 
 * Best practice: Use CRF for quality control, bitrate for size targeting
 */

/**
 * Video Compression - Supported Output Formats
 * 
 * MP4 (.mp4): H.264 video + AAC audio - Most compatible
 * MKV (.mkv): Can preserve original codecs, larger feature set
 * WebM (.webm): VP8/VP9 video + Opus audio - Web-focused
 */

const crfGuide = [
  { crf: 18, label: "High Quality", description: "Minimal compression, larger files" },
  { crf: 23, label: "Medium Quality", description: "Good balance, recommended default" },
  { crf: 28, label: "High Compression", description: "Smaller files, good quality" },
  { crf: 33, label: "Maximum Compression", description: "Smallest files, acceptable quality" },
];

export function generateMetadata(): Metadata {
  return VideoCompressorSeoPage();
}