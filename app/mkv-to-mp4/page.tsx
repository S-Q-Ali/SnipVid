import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "MKV to MP4 Converter - Convert Matroska to MP4",
  description:
    "Convert MKV (Matroska) files to MP4 format. Intelligent remux when H.264 codec is detected, or transcode with FFmpeg.",
  alternates: { canonical: "/mkv-to-mp4" },
};

export default function MkvToMp4Page() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          MKV to MP4
        </h1>
        <ConversionTool
          title="MKV to MP4"
          description="Convert MKV (Matroska) video files to MP4 format. Uses stream copy when compatible to preserve quality, or transcodes to H.264/AAC when needed."
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