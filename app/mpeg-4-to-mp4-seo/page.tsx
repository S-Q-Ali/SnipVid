import { Metadata } from "next";
import SeoPage, { getToolSeo } from "@/lib/seo/tool-seo";

export default function Mpeg4ToMp4SeoPage(): Metadata {
  const seo = getToolSeo("mpeg4");
  return SeoPage({
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    ogImage: seo.ogImage,
    twitterCard: seo.twitterCard,
  });
}

/* SEO Content for MPEG-4 to MP4 Page */

/**
 * MPEG-4 to MP4 - What is MPEG-4?
 * 
 * MPEG-4 is a codec (codec-name: mpeg4), not a container. 
 * It's often used inside .avi or .mkv containers.
 * 
 * MP4 is a container format that can hold H.264 video and AAC audio.
 * 
 * When to convert vs remux:
 * - Remux: If the video is already H.264 inside a different container, just remux to MP4
 * - Transcode: If the video uses an older codec (MPEG-4, DivX, XviD), re-encode to H.264
 */

const mpeg4Facts = {
  mpeg4_is_codec: "MPEG-4 is a video codec, not a container format",
  mp4_is_container: "MP4 is a container that typically holds H.264 video + AAC audio",
  when_to_remux: "Use stream copy when the video is already H.264,
  when_to_transcode: "Re-encode when the video uses MPEG-4, DivX, or XviD codecs",
  quality_preservation: "Remux preserves 100% quality (no re-encoding),
  transcoding may slightly reduce quality but offers maximum compatibility",
};

const conversionScenarios = [
  {
    scenario: "H.264 in MKV → MP4",
    description: "Stream copy possible - no quality loss, fast processing",
  },
  {
    scenario: "MPEG-4 in AVI → MP4",
    description: "Transcode required - re-encode to H.264, good compatibility",
  },
  {
    scenario: "MPEG-4 in MP4 → MP4",
    description: "May remux if container is already MP4, otherwise transcode",
  },
];

export function generateMetadata(): Metadata {
  return Mpeg4ToMp4SeoPage();
}