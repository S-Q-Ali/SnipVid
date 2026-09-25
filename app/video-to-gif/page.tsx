import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "Video to GIF - Create Animated GIFs from Video",
  description:
    "Convert video files to animated GIFs. Choose start and end times, adjust FPS, width and quality settings for optimal results.",
  alternates: { canonical: "/video-to-gif" },
};

export default function VideoToGifPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Video to GIF
        </h1>
        <ConversionTool
          title="Video to GIF"
          description="Create optimized animated GIFs from any video. Choose the start time, duration, FPS, and width for the best results."
          defaultOutputFormat="gif"
          formats={[
            { value: "gif", label: "GIF", description: "Animated GIF image" },
          ]}
          actionLabel="Create GIF"
          operation="gif"
          settingsFields={[
            {
              name: "start",
              label: "Start time (seconds)",
              type: "number",
              defaultValue: "0",
              placeholder: "0",
            },
            {
              name: "duration",
              label: "Duration (seconds)",
              type: "number",
              defaultValue: "5",
              placeholder: "5",
            },
            {
              name: "fps",
              label: "Frame rate",
              type: "number",
              defaultValue: "10",
              placeholder: "10",
            },
            {
              name: "width",
              label: "Width (px)",
              type: "number",
              defaultValue: "480",
              placeholder: "480",
            },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}