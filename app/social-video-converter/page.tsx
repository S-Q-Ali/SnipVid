import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "Social Media Video Converter - Format for Every Platform",
  description:
    "Convert and resize videos for YouTube, TikTok, Instagram, Facebook and X/Twitter with optimized aspect ratio presets.",
  alternates: { canonical: "/social-video-converter" },
};

export default function SocialVideoConverterPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Social Media Video Converter
        </h1>
        <ConversionTool
          title="Social Media Video Converter"
          description="Optimize your videos for social media platforms. Choose a platform preset or set custom dimensions to get the perfect aspect ratio."
          defaultOutputFormat="mp4"
          formats={[
            { value: "mp4", label: "MP4", description: "H.264 video, AAC audio" },
          ]}
          actionLabel="Convert for Social"
          operation="resize"
          settingsFields={[
            {
              name: "width",
              label: "Width (px)",
              type: "number",
              defaultValue: "1920",
              placeholder: "1920",
            },
            {
              name: "height",
              label: "Height (px)",
              type: "number",
              defaultValue: "1080",
              placeholder: "1080",
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