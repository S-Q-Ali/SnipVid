import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-foreground"
          aria-label="SnipVid homepage"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path
                d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>SnipVid</span>
        </Link>

        <nav aria-label="Primary navigation" className="flex items-center gap-5 text-sm font-medium text-muted-foreground">
          <a href="#supported-formats" className="transition-colors hover:text-foreground">
            Formats
          </a>
          <a href="#how-it-works" className="hidden sm:inline transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </a>
        </nav>
      </div>
    </header>
  );
}
