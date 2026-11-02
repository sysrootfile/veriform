/**
 * DSAR yasal süre matematiği — KVKK m.13: veri sahibi başvurusuna yanıt
 * en geç 30 gün içinde; gerekli hallerde bilgilendirilmek şartıyla bir kez
 * daha 30 gün uzatılabilir.
 */

export const DSAR_DEADLINE_DAYS = 30;
const DAY_MS = 86_400_000;

export function computeDeadline(receivedAt: string): string {
  return new Date(new Date(receivedAt).getTime() + DSAR_DEADLINE_DAYS * DAY_MS).toISOString();
}

export function extendDeadline(deadlineAt: string): string {
  return new Date(new Date(deadlineAt).getTime() + DSAR_DEADLINE_DAYS * DAY_MS).toISOString();
}

/** Kalan tam gün sayısı (tavan) — son gün 0, geçmişse negatif. */
export function daysLeft(receivedAt: string, now: string): number {
  const deadline = new Date(computeDeadline(receivedAt)).getTime();
  return Math.ceil((deadline - new Date(now).getTime()) / DAY_MS);
}

/** Süre geçti ve başvuru henüz sonuçlanmadı mı? */
export function isOverdue(
  receivedAt: string,
  now: string,
  status: "new" | "in-review" | "completed" | "rejected",
): boolean {
  if (status === "completed" || status === "rejected") return false;
  return new Date(now).getTime() > new Date(computeDeadline(receivedAt)).getTime();
}
