import type { Metadata } from "next";
import { ConversionTool } from "@/components/converter/conversion-tool";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";

export const metadata: Metadata = {
  title: "Video to MP3 - Extract Audio from Video",
  description:
    "Extract audio from video files and convert to MP3, WAV, AAC, and M4A. Choose the audio bitrate that suits your needs.",
  alternates: { canonical: "/video-to-mp3" },
};

export default function VideoToMp3Page() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Video to MP3
        </h1>
        <ConversionTool
          title="Video to MP3"
          description="Extract audio from any video file and convert it to MP3 format. Choose the bitrate that best balances quality and file size."
          defaultOutputFormat="mp3"
          formats={[
            { value: "mp3", label: "MP3", description: "MPEG audio layer 3" },
            { value: "wav", label: "WAV", description: "Lossless PCM audio" },
            { value: "m4a", label: "M4A", description: "AAC audio" },
          ]}
          actionLabel="Extract Audio"
          operation="convert"
          settingsFields={[
            {
              name: "bitrate",
              label: "Audio bitrate",
              type: "select",
              options: [
                { value: "128k", label: "128 kbps (Smaller size)" },
                { value: "192k", label: "192 kbps (Balanced)" },
                { value: "320k", label: "320 kbps (Best quality)" },
              ],
              defaultValue: "192k",
            },
          ]}
        />
      </main>
      <Footer />
    </div>
  );
}