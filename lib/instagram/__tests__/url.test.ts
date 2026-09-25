import { describe, it, expect } from "vitest";
import { classifyInstagramUrl, isInstagramUrl } from "../url";

describe("classifyInstagramUrl", () => {
  it("classifies a post URL", () => {
    const info = classifyInstagramUrl("https://www.instagram.com/p/CxYz123AbcD/");
    expect(info.kind).toBe("post");
    expect(info.mediaType).toBe("post");
    expect(info.shortcode).toBe("CxYz123AbcD");
  });

  it("ignores query parameters", () => {
    const info = classifyInstagramUrl(
      "https://www.instagram.com/reel/CxYz123AbcD/?igsh=abc123&utm_source=ig_web_button_share_sheet"
    );
    expect(info.kind).toBe("reel");
    expect(info.shortcode).toBe("CxYz123AbcD");
  });

  it("classifies a reel URL", () => {
    const info = classifyInstagramUrl("https://www.instagram.com/reel/CxYz123AbcD/");
    expect(info.kind).toBe("reel");
  });

  it("accepts the /reels/ path form", () => {
    const info = classifyInstagramUrl("https://www.instagram.com/reels/CxYz123AbcD/");
    expect(info.kind).toBe("reel");
  });

  it("treats IGTV /tv/ as a post", () => {
    const info = classifyInstagramUrl("https://www.instagram.com/tv/CxYz123AbcD/");
    expect(info.kind).toBe("post");
  });

  it("classifies a story URL", () => {
    const info = classifyInstagramUrl(
      "https://www.instagram.com/stories/jane.doe/1234567890123456/"
    );
    expect(info.kind).toBe("story");
    expect(info.username).toBe("jane.doe");
    expect(info.shortcode).toBe("1234567890123456");
  });

  it("classifies a highlight URL", () => {
    const info = classifyInstagramUrl(
      "https://www.instagram.com/stories/highlights/17893548012345678/"
    );
    expect(info.kind).toBe("highlight");
  });

  it("classifies a profile URL", () => {
    const info = classifyInstagramUrl("https://www.instagram.com/jane.doe/");
    expect(info.kind).toBe("profile");
    expect(info.username).toBe("jane.doe");
  });

  it("classifies a profile with a /posts/ subpath", () => {
    const info = classifyInstagramUrl("https://www.instagram.com/jane.doe/posts/");
    expect(info.kind).toBe("profile");
    expect(info.username).toBe("jane.doe");
  });

  it("rejects the bare domain", () => {
    expect(classifyInstagramUrl("https://www.instagram.com/").kind).toBe("unsupported");
  });

  it("rejects reserved explorer paths", () => {
    expect(classifyInstagramUrl("https://www.instagram.com/explore/").kind).toBe("unsupported");
    expect(classifyInstagramUrl("https://www.instagram.com/accounts/login/").kind).toBe(
      "unsupported"
    );
  });

  it("rejects non-Instagram hosts", () => {
    expect(classifyInstagramUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ").kind).toBe(
      "unsupported"
    );
    expect(classifyInstagramUrl("https://example.com/p/CxYz123AbcD/").kind).toBe("unsupported");
  });

  it("rejects invalid input", () => {
    expect(classifyInstagramUrl("not a url").kind).toBe("unsupported");
    expect(classifyInstagramUrl("").kind).toBe("unsupported");
  });

  it("accepts instagr.am short links and canonicalizes host", () => {
    const info = classifyInstagramUrl("https://instagr.am/p/CxYz123AbcD/");
    expect(info.kind).toBe("post");
    expect(info.canonicalUrl).toContain("https://www.instagram.com/");
  });

  it("normalizes host casing", () => {
    const info = classifyInstagramUrl("https://INSTAGRAM.COM/p/CxYz123AbcD/");
    expect(info.kind).toBe("post");
  });

  it("produces a canonical URL preserving the media path", () => {
    const info = classifyInstagramUrl("https://www.instagram.com/reel/CxYz123AbcD/");
    expect(info.canonicalUrl).toBe("https://www.instagram.com/reel/CxYz123AbcD/");
  });
});

describe("isInstagramUrl", () => {
  it("returns true for instagram links and false otherwise", () => {
    expect(isInstagramUrl("https://www.instagram.com/p/CxYz123AbcD/")).toBe(true);
    expect(isInstagramUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isInstagramUrl("garbage")).toBe(false);
  });
});