import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-bold tracking-tighter" aria-label="SnipVid homepage">
          SnipVid
        </Link>
        <p className="text-sm text-muted-foreground">Instagram downloader</p>
      </div>
    </header>
  );
}
