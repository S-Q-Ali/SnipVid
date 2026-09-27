import { describe, it, expect } from "vitest";

import { isJobId } from "../identifiers";

describe("isJobId", () => {
  it("accepts an id produced by randomUUID", () => {
    expect(isJobId("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
  });

  it("accepts an uppercase id", () => {
    expect(isJobId("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe(true);
  });

  // These all satisfy a loose "36 chars of hex or dash" test, which is why the
  // shared validator exists: the two routes had drifted into different rules.
  it("rejects a 36 character run of dashes", () => {
    expect(isJobId("------------------------------------")).toBe(false);
  });

  it("rejects hex digits in the wrong places", () => {
    expect(isJobId("3f2504e04f8911d39a0c0305e82c3301")).toBe(false);
    expect(isJobId("3f2504e0-4f89-11d3-9a0c-0305e82c330")).toBe(false);
    expect(isJobId("3f2504e0-4f89-11d3-9a0c-0305e82c33011")).toBe(false);
  });

  it("rejects a non-hex character", () => {
    expect(isJobId("3f2504e0-4f89-11d3-9a0c-0305e82c330g")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isJobId(undefined)).toBe(false);
    expect(isJobId(null)).toBe(false);
    expect(isJobId(42)).toBe(false);
    expect(isJobId(["3f2504e0-4f89-11d3-9a0c-0305e82c3301"])).toBe(false);
  });

  it("rejects surrounding whitespace", () => {
    expect(isJobId(" 3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(false);
  });
});
