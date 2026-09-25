import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "Video Resizer - Resize and Scale Videos",
  description:
    "Resize video files to any dimension. Use presets for social media or enter custom width and height with aspect ratio lock.",
  alternates: { canonical: "/video-resizer" },
};

export default function VideoResizerPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Video Resizer
        </h1>
        <ConversionTool
          title="Video Resizer"
          description="Resize your video to the perfect dimensions for any platform. Maintain aspect ratio or set custom width and height."
          defaultOutputFormat="mp4"
          formats={[
            { value: "mp4", label: "MP4", description: "H.264 video, AAC audio" },
          ]}
          actionLabel="Resize Video"
          operation="resize"
          settingsFields={[
            {
              name: "width",
              label: "Width (px)",
              type: "number",
              defaultValue: "1280",
              placeholder: "1280",
            },
            {
              name: "height",
              label: "Height (px)",
              type: "number",
              defaultValue: "720",
              placeholder: "720",
            },
            {
              name: "maintainRatio",
              label: "Maintain aspect ratio",
              type: "select",
              options: [
                { value: "true", label: "Yes - maintain aspect ratio" },
                { value: "false", label: "No - exact dimensions" },
              ],
              defaultValue: "true",
            },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}