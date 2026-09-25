import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "WebM to MP4 Converter - Convert WebM to MP4",
  description:
    "Convert WebM files to MP4 format. Transcode VP8/VP9 video to H.264 with AAC audio for maximum compatibility.",
  alternates: { canonical: "/webm-to-mp4" },
};

export default function WebmToMp4Page() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          WebM to MP4
        </h1>
        <ConversionTool
          title="WebM to MP4"
          description="Convert WebM video files to MP4 format. VP8/VP9 video is transcoded to H.264 with AAC audio for maximum compatibility."
          defaultOutputFormat="mp4"
          formats={[
            { value: "mp4", label: "MP4", description: "H.264 video, AAC audio" },
          ]}
          actionLabel="Convert to MP4"
        />
      </main>
      <Footer />
    </div>
  );
}