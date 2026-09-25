import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "Rotate Video - Flip and Rotate Videos",
  description:
    "Rotate video files 90°, 180° or 270°, or flip them horizontally or vertically with a single click.",
  alternates: { canonical: "/rotate-video" },
};

export default function RotateVideoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Rotate Video
        </h1>
        <ConversionTool
          title="Rotate Video"
          description="Rotate your video 90°, 180°, or 270°, or flip it horizontally or vertically. The rotation is applied with FFmpeg preserving quality."
          defaultOutputFormat="mp4"
          formats={[
            { value: "mp4", label: "MP4", description: "H.264 video, AAC audio" },
          ]}
          actionLabel="Rotate Video"
          operation="rotate"
          settingsFields={[
            {
              name: "angle",
              label: "Rotation / Flip",
              type: "select",
              options: [
                { value: "90", label: "Rotate 90° clockwise" },
                { value: "180", label: "Rotate 180°" },
                { value: "270", label: "Rotate 270° clockwise" },
                { value: "hflip", label: "Flip horizontally" },
                { value: "vflip", label: "Flip vertically" },
              ],
              defaultValue: "90",
            },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}