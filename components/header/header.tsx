import { Logo, Menu, Search, User, Settings, LogOut, Shield, X } from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  dropdown?: NavItem[];
}

export interface HeaderProps {
  hasDropdown?: boolean;
  onProfileClick?: () => void;
}

export function Header({ hasDropdown = true, onProfileClick }: HeaderProps = {}) {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="font-bold text-2xl tracking-tighter" aria-label="VideoToolkit homepage">
            VideoToolkit
          </a>
        </div>

        <nav className hidden md:block flex items-center gap-8">
          <a href="/video-downloader" className="hover:text-primary transition-colors" aria-label="Video Downloader">
            Downloader
          </a>
          <a href="/video-converter" className="hover:text-primary transition-colors" aria-label="Video Converter">
            Converter
          </a>
          <a href="/video-to-mp4" className="hover:text-primary transition-colors" aria-label="To MP4">
            To MP4
          </a>
          <a href="/mpeg-4-to-mp4" className="hover:text-primary transition-colors" aria-label="MPEG-4 to MP4">
            MPEG-4 → MP4
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <button className="btn btn-ghost hidden sm:block" aria-label="Open profile menu">
            <User className="h-5 w-5" />
          </button>

          {hasDropdown && (
            <div className="relative">
              <button
                onClick={onProfileClick}
                className="btn btn-ghost rounded-full p-2"
                aria-label="User menu"
              >
                <X className="h-4 w-4" />
              </button>

              {hasDropdown && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-lg bg-card border-border shadow-md p-4 opacity-0 pointer-events-none transition-opacity duration-300 group-hover:opacity-100 group-hover:pointer-events-auto"
                >
                  <h3 className="font-medium mb-2">User</h3>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <a href="/settings" className="hover:text-primary transition-colors">
                        Settings
                      </a>
                    </li>
                    <li>
                      <a href="/logout" className="hover:text-destructive transition-colors">
                        Logout
                      </a>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}