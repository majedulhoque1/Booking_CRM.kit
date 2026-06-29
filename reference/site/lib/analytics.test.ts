import { describe, expect, it } from "vitest";
import { buildBeaconPayload } from "./analytics";

describe("buildBeaconPayload", () => {
  it("includes referrer only on the first event", () => {
    const first = buildBeaconPayload("/services", "https://google.com", true);
    expect(JSON.parse(first)).toEqual({ path: "/services", referrer: "https://google.com" });

    const later = buildBeaconPayload("/about", "https://google.com", false);
    expect(JSON.parse(later)).toEqual({ path: "/about" });
  });

  it("omits referrer on first event when empty", () => {
    const first = buildBeaconPayload("/", "", true);
    expect(JSON.parse(first)).toEqual({ path: "/" });
  });
});
