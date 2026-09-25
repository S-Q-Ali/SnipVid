import { FolderDown, Image as ImageIcon, PlayCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";
import { InstagramDownloaderForm } from "@/components/instagram/downloader-form";

const FEATURES = [
  {
    title: "Posts & Photos",
    description: "Save any public post or photo, including carousels with all their items.",
    icon: ImageIcon,
  },
  {
    title: "Reels & Videos",
    description: "Download reels and video posts in original quality, anonymous and free.",
    icon: PlayCircle,
  },
  {
    title: "Stories & Highlights",
    description: "Grab stories and story highlights before they disappear.",
    icon: Sparkles,
  },
  {
    title: "100% Anonymous",
    description: "No login, no account, no cookies. Public content downloads instantly.",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              New · Instagram Downloader
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              Download Instagram Posts, Reels &amp; Photos
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Paste a link to any public Instagram post, reel, story, highlight, or profile —
              and save the media instantly. No login required.
            </p>
          </div>

          <div className="mt-10">
            <InstagramDownloaderForm />
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-base font-semibold">{feature.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <FolderDown className="h-4 w-4" />
            Anonymous downloader — we never ask for your Instagram login.
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
