export function Footer() {
  return (
    <footer className="border-t border-border bg-card py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">SnipVid</p>
          <p className="text-sm text-muted-foreground">
            Anonymous downloader for public Instagram posts, reels, photos and carousels.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          {new Date().getFullYear()} SnipVid. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
