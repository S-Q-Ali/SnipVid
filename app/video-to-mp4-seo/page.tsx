import { Metadata } from "next";
import SeoPage, { getToolSeo } from "@/lib/seo/tool-seo";

export default function VideoToMp4SeoPage(): Metadata {
  const seo = getToolSeo("to_mp4");
  return SeoPage({
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    ogImage: seo.ogImage,
    twitterCard: seo.twitterCard,
  });
}

/* SEO Content for Video to MP4 Page */

/**
 * Video to MP4 - Convert Any Video to MP4
 * 
 * MP4 (MPEG-4 Part 14) is the most widely compatible video format:
 * - Supported by virtually all devices, browsers, and media players
 * - H.264 video codec + AAC audio codec combination
 * - Ideal for sharing, uploading, and playing on any device
 * 
 * Smart Conversion Strategy:
 * 
 * 1. FFprobe Analysis:
 *    - Inspect input video container, codecs, resolution, duration
 *    - Determine if stream copy is viable
 * 
 * 2. Stream Copy (Remux) When:
 *    - Video codec is already H.264/AVC
 *    - Audio codec is AAC, MP3, or AC3
 *    - Container is compatible or can be easily converted
 *    - Benefits: No quality loss, very fast (seconds vs minutes)
 * 
 * 3. Transcode When:
 *    - Video uses older codecs (MPEG-4, DivX, XviD, VP8/VP9)
 *    - Audio uses proprietary or less compatible codecs
 *    - Need specific resolution/bitrate adjustments
 *    - Benefits: Maximum compatibility, can optimize settings
 * 
 * Default MP4 Settings:
 * 
 * Video:
 * - codec: H.264 (libx264)
 * - CRF: 23 (default, good balance)
 * - Resolution: Preserve original or resize
 * - FPS: Preserve original
 * - Pixel format: yuv420p (widely compatible)
 * 
 * Audio:
 * - codec: AAC
 * - bitrate: 128kbps (good quality, small size)
 * - Channels: Stereo (default)
 * 
 * Container:
 * - MP4 format with moov atom at start for streaming
 * - Fast start enabled for immediate playback
 */

const conversionTips = [
  "MP4 is compatible with virtually all devices and platforms",
  "H.264 + AAC is the safest default combination",
  "CRF 23 provides good quality at reasonable file size",
  "Use '-pix_fmt yuv420p' for maximum browser compatibility",
  "Add ' -movflags +faststart' for HTML5 video streaming",
  "Verify output with FFprobe before downloading",
];

const formatCompatibility = {
  mp4: "All browsers, all devices, QuickTime, Windows Media Player",
  mov: "Apple devices, QuickTime, some web browsers",
  mkv: "VLC, MPC-HC, some modern browsers (limited)",
  webm: "Chrome, Firefox, Edge, Opera (WebM native support)",
  avi: "Windows Media Player, VLC, QuickTime (limited)",
};

export function generateMetadata(): Metadata {
  return VideoToMp4SeoPage();
}