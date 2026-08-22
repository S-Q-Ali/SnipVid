import { Metadata } from "next";
import SeoPage, { getToolSeo } from "@/lib/seo/tool-seo";

export default function VideoCropperSeoPage(): Metadata {
  const seo = getToolSeo("crop");
  return SeoPage({
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    ogImage: seo.ogImage,
    twitterCard: seo.twitterCard,
  });
}

/* SEO Content for Video Cropper Page */

/**
 * Video Cropping - Why Crop?
 * 
 * Common reasons to crop videos:
 * - Remove unwanted borders or black bars
 * - Change aspect ratio for different platforms
 * - Focus on the subject of the video
 * - Create vertical video from horizontal footage
 * - Fit video to specific display requirements
 * 
 * Aspect Ratio Presets:
 * - 16:9: Standard widescreen (YouTube, TV, most online video)
 * - 9:16: Vertical (Instagram Stories, TikTok, mobile video)
 * - 1:1: Square (Instagram feed, thumbnails)
 * - 4:5: Vertical portrait (Instagram posts)
 * - 4:3: Older TV standard, some presentations
 * 
 * Custom Crop:
 * - Specify exact x, y coordinates and width/height
 * - Useful for removing specific unwanted areas
 * - Maintains control over framing
 * 
 * Visual vs Digital Crop:
 * - Visual crop in editing software shows preview in real-time
 * - Digital FFmpeg crop processes the specified rectangle
 * - Both result in the same final output dimensions
 */

/* End SEO Content */

export function generateMetadata(): Metadata {
  return VideoCropperSeoPage();
}