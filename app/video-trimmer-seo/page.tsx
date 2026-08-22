import { Metadata } from "next";
import SeoPage, { getToolSeo } from "@/lib/seo/tool-seo";

export default function VideoTrimmerSeoPage(): Metadata {
  const seo = getToolSeo("trim");
  return SeoPage({
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    ogImage: seo.ogImage,
    twitterCard: seo.twitterCard,
  });
}

/* SEO Content for Video Trimmer Page */

/**
 * Video Trimming - Why Trim?
 * 
 * Common reasons to trim videos:
 * - Remove intro/outro scenes
 * - Cut out mistakes or unwanted sections
 * - Create highlight reels
 * - Meet platform time limits (e.g., Instagram Stories)
 * - Reduce file size by removing unnecessary footage
 * 
 * Best practices:
 * - Always preview before trimming
 * - Keep at least 1 second of footage minimum
 * - Preserve audio quality by re-encoding the trimmed section
 * - Keyframe accuracy matters for smooth playback
 */

const trimTips = [
  "Use precise timecodes (HH:MM:SS) for accurate trimming",
  "Preview the trimmed clip before exporting",
  "Keep minimum 1 second of footage for smooth playback",
  "Re-encode trimmed section to avoid audio/video sync issues",
  "Consider the target platform's maximum duration limits",
];

const platformLimits = {
  youtube: "No practical limit",
  instagram_feed: "60 seconds",
  instagram_stories: "15 seconds",
  tiktok: "180 seconds (3 minutes)",
  twitter: "140 seconds",
  facebook: "240 minutes",
};

export function generateMetadata(): Metadata {
  return VideoTrimmerSeoPage();
}