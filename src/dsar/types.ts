/** DSAR (veri sahibi başvurusu) alan modeli — KVKK m.11 talep türleri. */

export const DSAR_TYPES = [
  "bilgi", // m.11/1-4: işlenip işlenmediği, amacı, aktarım bilgisi
  "duzeltme", // m.11/5
  "silme", // m.11/6 (unutulma hakkı)
  "aktarim-bildirimi", // m.11/7: 3. kişilere bildirim
  "itiraz", // m.11/8: otomatik analiz sonucuna itiraz
  "zarar-giderimi", // m.11/9
] as const;

export type DsarType = (typeof DSAR_TYPES)[number];

export type DsarStatus = "new" | "in-review" | "completed" | "rejected";

export interface DsarRequest {
  id: string;
  siteId: string;
  type: DsarType;
  subjectName: string;
  subjectEmail: string;
  message?: string | undefined;
  receivedAt: string;
  /** KVKK m.13: alım + 30 gün (uzatma ile +30 daha). */
  deadlineAt: string;
  status: DsarStatus;
  extended?: boolean | undefined;
  respondedAt?: string | undefined;
  responseNote?: string | undefined;
}
