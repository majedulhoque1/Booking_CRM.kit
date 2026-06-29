import { describe, expect, it } from "vitest";
import {
  tzDateString,
  isBot,
  normalizePath,
  parseReferrerHost,
  deviceFromUA,
  visitorHash,
} from "./analytics-collect";

describe("normalizePath", () => {
  it("strips query string and trailing slash, keeps root", () => {
    expect(normalizePath("/services/?x=1")).toBe("/services");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/blog/post-1")).toBe("/blog/post-1");
  });
  it("falls back to / for empty/invalid", () => {
    expect(normalizePath("")).toBe("/");
    expect(normalizePath(undefined as unknown as string)).toBe("/");
  });
});

describe("parseReferrerHost", () => {
  it("returns host for external referrer", () => {
    expect(parseReferrerHost("https://www.google.com/search?q=x")).toBe("www.google.com");
  });
  it("returns null for empty referrer", () => {
    expect(parseReferrerHost("")).toBeNull();
    expect(parseReferrerHost(undefined)).toBeNull();
  });
});

describe("deviceFromUA", () => {
  it("detects mobile and desktop", () => {
    expect(deviceFromUA("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)")).toBe("mobile");
    expect(deviceFromUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    expect(deviceFromUA("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)")).toBe("tablet");
  });
});

describe("isBot", () => {
  it("flags common crawlers", () => {
    expect(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0)")).toBe(false);
    expect(isBot("")).toBe(true); // empty UA treated as bot
  });
});

describe("visitorHash", () => {
  it("is deterministic within the same day inputs and rotates across days", async () => {
    const a = await visitorHash("salt", "1.2.3.4", "UA", "2026-06-23");
    const b = await visitorHash("salt", "1.2.3.4", "UA", "2026-06-23");
    const c = await visitorHash("salt", "1.2.3.4", "UA", "2026-06-24");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("tzDateString", () => {
  it("returns YYYY-MM-DD", () => {
    expect(tzDateString(new Date("2026-06-23T20:00:00Z"), "Asia/Dhaka")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tzDateString(new Date("2026-06-23T20:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
