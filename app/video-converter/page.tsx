import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "Video Converter - Convert Videos Between Formats",
  description:
    "Convert videos between MP4, MKV, MOV, AVI, WebM and other formats. Powered by FFmpeg with real progress tracking.",
  alternates: { canonical: "/video-converter" },
};

export default function VideoConverterPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Video Converter
        </h1>
        <ConversionTool
          title="Video Converter"
          description="Upload a video and convert it to your desired format. Conversion is powered by FFmpeg on the server and supports MP4, MOV, MKV, WebM, AVI and more."
          defaultOutputFormat="mp4"
          actionLabel="Convert Video"
        />
      </main>
      <Footer />
    </div>
  );
}