import type { Metadata } from "next";

interface SeoProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  twitterCard?: string;
}

/**
 * SEO Page Component
 * Generates unique metadata for each tool page
 */
export function SeoPage({ title, description, canonical, ogImage, twitterCard }: SeoProps): Metadata {
  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title,
      description,
      images: [
        {
          url: ogImage || "/og-image.png",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: (twitterCard as "summary_large_image" | "summary") || "summary_large_image",
      title,
      description,
      images: [ogImage || "/og-image.png"],
    },
    icons: {
      icon: "/favicon.ico",
    },
  };
}

/**
 * Tool SEO Data
 * Defines unique SEO content for each tool page
 */
const toolSeoData: Record<string, SeoProps> = {
  home: {
    title: "VideoToolkit - Complete Video Processing Utility",
    description: "All-in-one online video utility platform - download, convert, compress, resize and process videos from one place",
    canonical: "/",
    ogImage: "/og-image.png",
    twitterCard: "summary_large_image",
  },
  downloader: {
    title: "Video Downloader - Download Videos from YouTube and Other Platforms",
    description: "Download videos from YouTube, Vimeo, Facebook, Instagram and other supported platforms. Enter a URL and choose quality.",
    canonical: "/video-downloader",
    ogImage: "/og-downloader.png",
    twitterCard: "summary_large_image",
  },
  converter: {
    title: "Video Converter - Convert Videos Between Formats",
    description: "Convert videos between MP4, MKV, MOV, AVI, WebM and other formats. Powered by FFmpeg with real progress tracking.",
    canonical: "/video-converter",
    ogImage: "/og-converter.png",
    twitterCard: "summary_large_image",
  },
  mpeg4: {
    title: "MPEG-4 to MP4 Converter - Convert and Remux",
    description: "Convert MPEG-4 files to MP4. Intelligent remux when possible (no re-encoding), or transcode with H.264/AAC defaults for maximum compatibility.",
    canonical: "/mpeg-4-to-mp4",
    ogImage: "/og-mpeg4.png",
    twitterCard: "summary_large_image",
  },
  mov: {
    title: "MOV to MP4 Converter - Convert QuickTime to MP4",
    description: "Convert MOV (QuickTime) files to MP4 format. Support for H.264 stream copy and transcoding with quality defaults.",
    canonical: "/mov-to-mp4",
    ogImage: "/og-mov.png",
    twitterCard: "summary_large_image",
  },
  mkv: {
    title: "MKV to MP4 Converter - Convert Matroska to MP4",
    description: "Convert MKV (Matroska) files to MP4 format. Intelligent remux when H.264 codec is detected, or transcode with FFmpeg.",
    canonical: "/mkv-to-mp4",
    ogImage: "/og-mkv.png",
    twitterCard: "summary_large_image",
  },
  webm: {
    title: "WebM to MP4 Converter - Convert WebM to MP4",
    description: "Convert WebM files to MP4 format. Transcode VP8/VP9 video to H.264 with AAC audio for maximum compatibility.",
    canonical: "/webm-to-mp4",
    ogImage: "/og-webm.png",
    twitterCard: "summary_large_image",
  },
  avi: {
    title: "AVI to MP4 Converter - Convert AVI to MP4",
    description: "Convert AVI files to MP4 format. Support for various AVI codecs including MPEG-4, DivX, XviD, and transcoding with H.264/AAC defaults.",
    canonical: "/avi-to-mp4",
    ogImage: "/og-avi.png",
    twitterCard: "summary_large_image",
  },
  compress: {
    title: "Video Compressor - Compress Videos Online",
    description: "Compress videos easily with CRF quality control, bitrate settings, and preview of original vs compressed file size.",
    canonical: "/video-compressor",
    ogImage: "/og-compress.png",
    twitterCard: "summary_large_image",
  },
  resize: {
    title: "Video Resizer - Resize Videos for Social Media",
    description: "Resize videos to social media presets (YouTube, TikTok, Instagram) or custom dimensions. Maintain aspect ratio or specify custom width/height.",
    canonical: "/video-resizer",
    ogImage: "/og-resize.png",
    twitterCard: "summary_large_image",
  },
  trim: {
    title: "Video Trimmer - Trim and Cut Videos",
    description: "Trim videos by specifying start and end times. Cut out unwanted sections while preserving quality with FFmpeg-based processing.",
    canonical: "/video-trimmer",
    ogImage: "/og-trim.png",
    twitterCard: "summary_large_image",
  },
  crop: {
    title: "Video Cropper - Crop Videos",
    description: "Crop videos to aspect ratio presets (16:9, 9:16, 1:1, 4:5, 4:3) or custom dimensions. Remove unwanted areas and resize to target dimensions.",
    canonical: "/video-cropper",
    ogImage: "/og-crop.png",
    twitterCard: "summary_large_image",
  },
  gif: {
    title: "GIF Creator - Create GIFs from Videos",
    description: "Create optimized GIFs from videos with start/end time, FPS, and width controls. Generate small, optimized GIFs from any video file.",
    canonical: "/video-to-gif",
    ogImage: "/og-gif.png",
    twitterCard: "summary_large_image",
  },
  to_mp4: {
    title: "Video to MP4 - Convert Any Video to MP4",
    description: "Convert any video file to MP4 format with H.264 video and AAC audio defaults. Smart detection of whether stream copy or transcoding is needed.",
    canonical: "/video-to-mp4",
    ogImage: "/og-mp4.png",
    twitterCard: "summary_large_image",
  },
};

/**
 * Get SEO metadata for a specific tool page
 */
export function getToolSeo(tool: keyof typeof toolSeoData): SeoProps {
  return toolSeoData[tool] || toolSeoData.home;
}

/**
 * Homepage SEO component
 */
export function HomepageSeo() {
  return getToolSeo("home");
}

/**
 * Dynamic route metadata generator
 * Used for [tool] routes in next.config.js
 */
export function getToolMetadata(tool: keyof typeof toolSeoData): Metadata {
  const seo = getToolSeo(tool);
  return SeoPage(seo);
}
