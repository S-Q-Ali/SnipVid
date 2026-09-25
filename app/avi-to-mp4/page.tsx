import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "AVI to MP4 Converter - Convert AVI to MP4",
  description:
    "Convert AVI files to MP4 format. Support for various AVI codecs including MPEG-4, DivX, XviD, and transcoding with H.264/AAC defaults.",
  alternates: { canonical: "/avi-to-mp4" },
};

export default function AviToMp4Page() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          AVI to MP4
        </h1>
        <ConversionTool
          title="AVI to MP4"
          description="Convert AVI video files to MP4 format with H.264/AAC encoding for maximum compatibility across devices and platforms."
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