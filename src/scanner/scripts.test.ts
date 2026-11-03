import { describe, expect, it } from "vitest";
import { classifyScript } from "./scripts.js";

describe("classifyScript", () => {
  it("aynı kaynak (first-party) scripti first-party der", () => {
    expect(classifyScript("https://site.com/app.js", "https://site.com")).toBe("first-party");
  });

  it("bilinen analitik/etiket yükleyicilerini analytics der", () => {
    for (const url of [
      "https://www.googletagmanager.com/gtag/js?id=G-1",
      "https://www.google-analytics.com/analytics.js",
      "https://t3.com/gtag.js",
    ]) {
      expect(classifyScript(url, "https://site.com")).toBe("analytics");
    }
  });

  it("bilinen reklam/piksel hostlarını marketing der", () => {
    for (const url of [
      "https://connect.facebook.net/en_US/fbevents.js",
      "https://googleads.g.doubleclick.net/pagead/id",
      "https://analytics.tiktok.com/i18n/pixel/events.js",
    ]) {
      expect(classifyScript(url, "https://site.com")).toBe("marketing");
    }
  });

  it("bilinen sosyal/destek gömülerini social der", () => {
    for (const url of [
      "https://platform.twitter.com/widgets.js",
      "https://widget.clarity.chat/embed",
    ]) {
      expect(classifyScript(url, "https://site.com")).toBe("social");
    }
  });

  it("bilinmeyen üçüncü tarafı third-party-unknown der (dürüst çıktı)", () => {
    expect(classifyScript("https://cdn.zararsiz-cdn.net/bundle.js", "https://site.com")).toBe(
      "third-party-unknown",
    );
  });
});
