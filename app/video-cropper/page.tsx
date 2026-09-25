import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "Video Cropper - Crop Videos to Any Shape",
  description:
    "Crop video files to fit any aspect ratio or dimensions. Use presets for popular platforms or set custom crop areas.",
  alternates: { canonical: "/video-cropper" },
};

export default function VideoCropperPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Video Cropper
        </h1>
        <ConversionTool
          title="Video Cropper"
          description="Crop your video to remove unwanted areas. Set the crop width, height, and position to get the exact frame you need."
          defaultOutputFormat="mp4"
          formats={[
            { value: "mp4", label: "MP4", description: "H.264 video, AAC audio" },
          ]}
          actionLabel="Crop Video"
          operation="crop"
          settingsFields={[
            {
              name: "width",
              label: "Crop width (px)",
              type: "number",
              defaultValue: "1280",
              placeholder: "1280",
            },
            {
              name: "height",
              label: "Crop height (px)",
              type: "number",
              defaultValue: "720",
              placeholder: "720",
            },
            {
              name: "x",
              label: "X offset (px)",
              type: "number",
              defaultValue: "0",
              placeholder: "0",
            },
            {
              name: "y",
              label: "Y offset (px)",
              type: "number",
              defaultValue: "0",
              placeholder: "0",
            },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}