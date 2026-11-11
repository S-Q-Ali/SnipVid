import {
  CheckCircle2,
  ClipboardPaste,
  FolderDown,
  Image as ImageIcon,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";
import { InstagramDownloaderForm } from "@/components/instagram/downloader-form";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const FEATURES = [
  {
    title: "Posts & Carousels",
    description: "Inspect multi-slide posts and download a single slide or all items together.",
    icon: FolderDown,
  },
  {
    title: "Reels & Videos",
    description: "Saved as H.264 MP4 with AAC audio so videos play smoothly on iPhone and desktop.",
    icon: PlayCircle,
  },
  {
    title: "Photos & Images",
    description: "Extracts standalone Instagram photo posts and image slides cleanly in JPG format.",
    icon: ImageIcon,
  },
  {
    title: "No Login Needed",
    description: "No accounts, extensions, or cookies. Public Instagram links fetch directly.",
    icon: ShieldCheck,
  },
];

const STEPS = [
  {
    title: "Copy a public link",
    description:
      "Open Instagram, tap Share on any public post, reel, photo, or carousel, and copy the link.",
    icon: ClipboardPaste,
  },
  {
    title: "Analyze the media",
    description:
      "Paste the URL above and click Analyze to preview the title, duration, and carousel items.",
    icon: CheckCircle2,
  },
  {
    title: "Save to your device",
    description:
      "Download an individual photo or video slide, or fetch the full carousel in one batch.",
    icon: FolderDown,
  },
];

const FAQS = [
  {
    question: "Which Instagram links work without logging in?",
    answer:
      "Public Instagram posts (/p/), reels (/reel/), video posts (/tv/), photo posts, and carousels — including share URLs with a username prefix like instagram.com/username/reel/... — work anonymously.",
  },
  {
    question: "Why do Stories, Highlights, or private accounts fail?",
    answer:
      "Instagram blocks anonymous access to private accounts, Stories, and Highlights behind a login wall. SnipVid stays anonymous and only downloads publicly accessible content.",
  },
  {
    question: "Do downloaded Reels work on iPhone and Safari?",
    answer:
      "Yes. SnipVid prefers H.264 video with AAC audio inside an MP4 container so downloaded clips open cleanly in iOS Photos, Safari, and QuickTime.",
  },
  {
    question: "How long are downloaded files stored on the server?",
    answer:
      "Files are stored temporarily only long enough to stream to your browser and are automatically deleted after 1 hour.",
  },
];

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c"),
        }}
      />
      <Header />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-4xl px-4 pb-12 pt-10 sm:px-6 sm:pt-16">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Download Instagram Posts, Reels &amp; Photos
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Paste a public Instagram link to preview its slides and save clean MP4 videos or JPG
              images in seconds.
            </p>
          </div>

          <div className="mt-8 sm:mt-10">
            <InstagramDownloaderForm />
          </div>
        </section>

        <section
          id="supported-formats"
          aria-labelledby="formats-heading"
          className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6"
        >
          <h2 id="formats-heading" className="sr-only">
            Supported Instagram formats
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              >
                <div className="mb-3.5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6"
        >
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h2
              id="how-heading"
              className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl"
            >
              How it works
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Three quick steps from link to download.
            </p>

            <ol className="mt-6 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6"
        >
          <h2
            id="faq-heading"
            className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl"
          >
            Frequently asked questions
          </h2>
          <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-card">
            {FAQS.map((item) => (
              <details key={item.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
                  <span className="text-sm sm:text-base">{item.question}</span>
                  <span
                    aria-hidden="true"
                    className="text-lg font-normal text-muted-foreground transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
