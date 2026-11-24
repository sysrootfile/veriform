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

/** Self-servis kayıtta başlayan deneme süresi (gün). */
export const TRIAL_DAYS = 14;

/**
 * Kota denetiminde geçerli paket: deneme bittiyse starter'a düşer.
 * trialEndsAt yoksa (operatör kurulumu / onaylanmış abonelik) paket aynen geçerli.
 */
export function effectivePackage(
  tenant: { package: ContactPackage; trialEndsAt?: string | undefined },
  now: Date = new Date(),
): ContactPackage {
  if (tenant.trialEndsAt && now.getTime() > new Date(tenant.trialEndsAt).getTime()) {
    return "starter";
  }
  return tenant.package;
}

/** Deneme kalan günü: deneme yoksa null, bittiyse 0, sürerken yukarı yuvarlanmış tam gün. */
export function trialDaysLeft(
  trialEndsAt: string | undefined,
  now: Date = new Date(),
): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86400000);
}