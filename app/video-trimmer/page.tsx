import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "Video Trimmer - Cut and Trim Videos Online",
  description:
    "Trim video files by selecting start and end times. Remove unwanted parts and export the result.",
  alternates: { canonical: "/video-trimmer" },
};

export default function VideoTrimmerPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Video Trimmer
        </h1>
        <ConversionTool
          title="Video Trimmer"
          description="Cut out unwanted sections of your video by specifying start time and duration. The trimmed section is re-encoded with FFmpeg."
          defaultOutputFormat="mp4"
          formats={[
            { value: "mp4", label: "MP4", description: "H.264 video, AAC audio" },
          ]}
          actionLabel="Trim Video"
          operation="trim"
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
              defaultValue: "10",
              placeholder: "10",
            },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}