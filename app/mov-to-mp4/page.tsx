import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "MOV to MP4 Converter - Convert QuickTime to MP4",
  description:
    "Convert MOV (QuickTime) files to MP4 format. Support for H.264 stream copy and transcoding with quality defaults.",
  alternates: { canonical: "/mov-to-mp4" },
};

export default function MovToMp4Page() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          MOV to MP4
        </h1>
        <ConversionTool
          title="MOV to MP4"
          description="Convert QuickTime MOV files to MP4 format. Uses stream copy when the codecs are compatible to preserve quality and speed."
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