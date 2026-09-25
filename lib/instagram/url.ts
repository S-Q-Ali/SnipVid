export type InstagramMediaType = "post" | "reel" | "story" | "highlight" | "profile";

export type InstagramUrlKind = InstagramMediaType | "unsupported";

export interface InstagramUrlInfo {
  kind: InstagramUrlKind;
  mediaType?: InstagramMediaType;
  canonicalUrl: string;
  shortcode?: string;
  username?: string;
}

const ALLOWED_HOSTS = new Set(["instagram.com", "www.instagram.com", "instagr.am"]);

const RESERVED_PATHS = new Set([
  "about",
  "accounts",
  "ads",
  "blog",
  "create",
  "direct",
  "discover",
  "embed",
  "explore",
  "help",
  "legal",
  "maps",
  "oauth",
  "p",
  "press",
  "privacy",
  "reel",
  "reels",
  "shop",
  "stories",
  "tv",
  "web",
]);

export function isInstagramUrl(input: string): boolean {
  return classifyInstagramUrl(input).kind !== "unsupported";
}

export function classifyInstagramUrl(input: string): InstagramUrlInfo {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return unsupported(input);
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return unsupported(input);
  }

  const segments = parsed.pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment));

  if (segments.length === 0) {
    return unsupported(input);
  }

  const first = segments[0];
  const canonicalPath = `/${segments.join("/")}/`;

  if (first === "p" || first === "tv") {
    return media("post", input, segments[1]);
  }

  if (first === "reel" || first === "reels") {
    return media("reel", input, segments[1]);
  }

  if (first === "stories") {
    if (segments[1] === "highlights") {
      return media("highlight", input, segments[2]);
    }
    return {
      kind: "story",
      mediaType: "story",
      username: segments[1],
      shortcode: segments[2],
      canonicalUrl: `https://www.instagram.com${canonicalPath}`,
    };
  }

  if (RESERVED_PATHS.has(first)) {
    return unsupported(input);
  }

  return {
    kind: "profile",
    mediaType: "profile",
    username: first,
    canonicalUrl: `https://www.instagram.com${canonicalPath}`,
  };
}

function media(
  mediaType: InstagramMediaType,
  _input: string,
  shortcode?: string
): InstagramUrlInfo {
  if (!shortcode) {
    return { kind: "unsupported", canonicalUrl: "" };
  }
  return {
    kind: mediaType,
    mediaType,
    shortcode,
    canonicalUrl: `https://www.instagram.com/${mediaPath(mediaType, shortcode)}/`,
  };
}

function mediaPath(mediaType: InstagramMediaType, shortcode: string): string {
  switch (mediaType) {
    case "post":
      return `p/${shortcode}`;
    case "reel":
      return `reel/${shortcode}`;
    case "story":
      return `stories/${shortcode}`;
    case "highlight":
      return `stories/highlights/${shortcode}`;
    case "profile":
      return shortcode;
  }
}

function unsupported(input: string): InstagramUrlInfo {
  return { kind: "unsupported", canonicalUrl: "" };
}