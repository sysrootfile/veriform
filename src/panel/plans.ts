import type { ContactPackage } from "./types.js";

/** Paket site kotaları — landing tarifesiyle aynı söz: 3 / 15 / sınırsız. */
export const PLAN_LIMITS: Record<ContactPackage, number | null> = {
  starter: 3,
  pro: 15,
  ultimate: null,
};

export const PLAN_LABELS: Record<ContactPackage, string> = {
  starter: "Starter",
  pro: "Pro",
  ultimate: "Ultimate",
};

export function isContactPackage(value: unknown): value is ContactPackage {
  return value === "starter" || value === "pro" || value === "ultimate";
}