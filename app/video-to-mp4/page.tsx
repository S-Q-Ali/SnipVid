import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "Video to MP4 - Convert Any Video to MP4",
  description:
    "Convert any video file to MP4 format with H.264 video and AAC audio defaults. Smart detection of whether stream copy or transcoding is needed.",
  alternates: { canonical: "/video-to-mp4" },
};

export default function VideoToMp4Page() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Video to MP4
        </h1>
        <ConversionTool
          title="Video to MP4"
          description="Convert any video file to MP4 with H.264 video and AAC audio for maximum compatibility across all devices and platforms."
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