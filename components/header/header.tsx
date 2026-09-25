"use client";
import { User, Menu, X } from "lucide-react";
import * as React from "react";


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
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="font-bold text-2xl tracking-tighter" aria-label="VideoToolkit homepage">
            VideoToolkit
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          <a href="/video-downloader" className="hover:text-primary transition-colors">
            Downloader
          </a>
          <a href="/video-converter" className="hover:text-primary transition-colors">
            Converter
          </a>
          <a href="/video-to-mp4" className="hover:text-primary transition-colors">
            To MP4
          </a>
          <a href="/mpeg-4-to-mp4" className="hover:text-primary transition-colors">
            MPEG-4 → MP4
          </a>
        </nav>

        <div className="flex items-center gap-4">
          {hasDropdown && (
            <button
              onClick={onProfileClick}
              className="btn btn-ghost hidden sm:flex items-center gap-2"
              aria-label="Open profile menu"
            >
              <User className="h-5 w-5" />
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden btn btn-ghost"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border px-4 py-3 flex flex-col gap-3" aria-label="Mobile navigation">
          <a href="/video-downloader" className="hover:text-primary transition-colors">
            Video Downloader
          </a>
          <a href="/video-converter" className="hover:text-primary transition-colors">
            Video Converter
          </a>
          <a href="/video-to-mp4" className="hover:text-primary transition-colors">
            Video to MP4
          </a>
          <a href="/mpeg-4-to-mp4" className="hover:text-primary transition-colors">
            MPEG-4 to MP4
          </a>
        </nav>
      )}
    </header>
  );
}