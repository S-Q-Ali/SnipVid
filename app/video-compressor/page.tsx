import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "Video Compressor - Reduce Video File Size",
  description:
    "Compress video files to reduce size while maintaining quality. Choose from small, balanced, or high-quality compression presets.",
  alternates: { canonical: "/video-compressor" },
};

export default function VideoCompressorPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Video Compressor
        </h1>
        <ConversionTool
          title="Video Compressor"
          description="Compress your video to reduce file size while preserving quality. Choose a compression level and let FFmpeg handle the encoding."
          defaultOutputFormat="mp4"
          formats={[
            { value: "mp4", label: "MP4", description: "H.264 video, AAC audio" },
          ]}
          actionLabel="Compress Video"
          operation="compress"
          settingsFields={[
            {
              name: "quality",
              label: "Compression level",
              type: "select",
              options: [
                { value: "small", label: "Small - Minimum file size" },
                { value: "balanced", label: "Balanced - Good quality/size" },
                { value: "high", label: "High Quality - Minimal compression" },
              ],
              defaultValue: "balanced",
            },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}