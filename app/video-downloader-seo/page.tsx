import { Metadata } from "next";
import SeoPage, { getToolSeo } from "@/lib/seo/tool-seo";

export default function VideoDownloaderSeoPage(): Metadata {
  const seo = getToolSeo("downloader");
  return SeoPage({
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    ogImage: seo.ogImage,
    twitterCard: seo.twitterCard,
  });
}

/* SEO Content for Video Downloader Page */

/**
 * Video Downloader - FAQ Section
 * Frequently asked questions about video downloading
 */

const faqData = [
  {
    question: "Can I download any YouTube video?",
    answer: "Most publicly accessible YouTube videos can be downloaded. However, videos with DRM, age restrictions, or private settings cannot be downloaded due to YouTube's policies.",
  },
  {
    question: "Are downloaded videos high quality?",
    answer: "Yes, you can choose from available qualities ranging from 144p to 4K, depending on what the source platform offers.",
  },
  {
    question: "Is the downloader safe to use?",
    answer: "Yes, we only process publicly accessible URLs and never expose user data or credentials. All downloads happen server-side.",
  },
];

/**
 * Video Downloader - Structured Data
 * Schema.org structured data for the video downloader tool
 */

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Video Downloader",
  "description": "Download videos from YouTube, Vimeo, Facebook, Instagram and other supported platforms",
  "applicationCategory": "MediaApplication",
  "operatingSystem": "Web-based",
  "offers": {
    "@type": "Offer",
    "name": "Video Download",
    "price": "Free",
    "priceCurrency": "USD",
  },
  "author": {
    "@type": "Organization",
    "name": "VideoToolkit",
  },
};

/* End SEO Content */

export function generateMetadata(): Metadata {
  return VideoDownloaderSeoPage();
}