import { CheckCircle, Image, Mouse, FolderInput, Zap, Lupe, Scale, Crop, Scissors, AlignCenter, FormatAudio, Repeat, Video, Settings, Trash, Calendar, Loader2, Folder, Globe, Music, Layout, LucideIcon } from "lucide-react";

export interface Tool {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
}

export const tools: Tool[] = [
  {
    id: "downloader",
    title: "Video Downloader",
    description: "Download videos from supported platforms",
    href: "/video-downloader",
    icon: Folder,
    color: "bg-blue-500/20 text-blue-400",
  },
  {
    id: "converter",
    title: "Video Converter",
    description: "Convert videos between formats",
    href: "/video-converter",
    icon: Zap,
    color: "bg-purple-500/20 text-purple-400",
  },
  {
    id: "mp4",
    title: "To MP4",
    description: "Convert any video to MP4",
    href: "/video-to-mp4",
    icon: Scale,
    color: "bg-green-500/20 text-green-400",
  },
  {
    id: "mpeg4",
    title: "MPEG-4 to MP4",
    description: "Convert MPEG-4 files to MP4",
    href: "/mpeg-4-to-mp4",
    icon: Crop,
    color: "bg-orange-500/20 text-orange-400",
  },
  {
    id: "compressor",
    title: "Video Compressor",
    description: "Compress videos easily",
    icon: Scissors,
    color: "bg-red-500/20 text-red-400",
  },
  {
    id: "resizer",
    title: "Video Resizer",
    description: "Resize videos for social media",
    icon: Layout,
    color: "bg-yellow-500/20 text-yellow-400",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-foreground mb-4">
            Your Complete Video Toolkit
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Download, convert, compress, resize and process videos from one place. Powerful FFmpeg-based processing with real progress tracking.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className={`group rounded-xl p-6 text-left transition-all duration-300 hover:shadow-lg ${tool.color}`}
            >
              <tool className="h-12 w-12 mx-auto mb-4 group-hover:opacity-100" />
              <h3 className="text-xl font-medium mb-2">{tool.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-12 border-t border-border flex justify-center">
          <p className="text-sm text-muted-foreground">
            Supported formats and platforms{" "}
            <a href="/video-downloader" className="font-medium underline underline-offset-2 hover:text-primary">
              Learn more
            </a>.
          </p>
        </div>
      </div>
    </main>
  );
}