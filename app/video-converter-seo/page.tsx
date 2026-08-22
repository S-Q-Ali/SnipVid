import { Metadata } from "next";
import SeoPage, { getToolSeo } from "@/lib/seo/tool-seo";

export default function VideoConverterSeoPage(): Metadata {
  const seo = getToolSeo("converter");
  return SeoPage({
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    ogImage: seo.ogImage,
    twitterCard: seo.twitterCard,
  });
}

/* SEO Content for Video Converter Page */

/**
 * Video Converter - Supported Formats
 * Common video formats supported by the converter
 */

const supportedFormats = [
  { name: "MP4", extension: ".mp4", codec: "H.264/AAC", compatible: true },
  { name: "MKV", extension: ".mkv", codec: "H.264/AAC, Vorbis, AAC", compatible: true },
  { name: "MOV", extension: ".mov", codec: "H.264, ProRes, MPEG-4", compatible: true },
  { name: "AVI", extension: ".avi", codec: "MPEG-4, DivX, XviD, H.264", compatible: true },
  { name: "WebM", extension: ".webm", codec: "VP8, VP9, Opus", compatible: true },
  { name: "MPEG-4", extension: ".mp4, .m4v", codec: "H.264, MPEG-4", compatible: true },
];

/**
 * Video Converter - Format Conversion Guide
 * Guide to converting between video formats
 */

const conversionGuide = {
  mov_to_mp4: "Convert QuickTime files to MP4. H.264 stream copy usually possible.",
  mkv_to_mp4: "Convert Matroska to MP4. H.264 stream copy usually possible.",
  webm_to_mp4: "Convert WebM to MP4. Requires transcoding to H.264/AAC.",
  avi_to_mp4: "Convert AVI to MP4. Transcoding required for most codecs.",
};

export function generateMetadata(): Metadata {
  return VideoConverterSeoPage();
}