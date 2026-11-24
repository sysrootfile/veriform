import { describe, expect, it } from "vitest";
import { FONT_FACES, WORLD_TOKENS } from "./design.js";
import { renderLandingPage } from "./landing.js";

describe("design.ts — tek dünya kaynağı", () => {
  it("FONT_FACES dört self-host woff2 tanımı taşır", () => {
    expect((FONT_FACES.match(/@font-face/g) ?? []).length).toBe(4);
    for (const f of [
      "archivo-latin-ext.woff2",
      "archivo-latin.woff2",
      "spline-mono-latin-ext.woff2",
      "spline-mono-latin.woff2",
    ]) {
      expect(FONT_FACES).toContain(f);
    }
  });

  it("landing aynı FONT_FACES kaynağını kullanır", () => {
    expect(renderLandingPage()).toContain(FONT_FACES);
  });

  it("tokenlar DESIGN.md paletiyle birebir", () => {
    for (const t of [
      "--paper:#f6f7f4",
      "--desk:#e7e9e2",
      "--ink:#191d26",
      "--ink-soft:#3f4553",
      "--blue:#2447c9",
      "--red:#c93a2e",
      "--green:#1e7a46",
      "--amber:#b45309",
    ]) {
      expect(WORLD_TOKENS).toContain(t);
    }
  });
});