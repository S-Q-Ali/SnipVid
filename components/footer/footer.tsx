export function Footer() {
  return (
    <footer className="border-t border-border bg-card py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-display font-semibold text-foreground">SnipVid</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Anonymous downloader for public Instagram posts, reels, photos, and carousels.
          </p>
        </div>

        <div className="text-xs text-muted-foreground sm:text-right">
          <p>{new Date().getFullYear()} SnipVid. Public media only.</p>
          <p className="mt-1">Not affiliated with Instagram or Meta.</p>
        </div>
      </div>
    </footer>
  );
}
