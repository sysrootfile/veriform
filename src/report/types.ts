import type { FieldCategory, FieldClassification, FieldMeta } from "../classifier/types.js";
import type { RequestTarget } from "../collector/targets.js";

/** Tarayıcı keşfinin rapora giren değer içermeyen özeti. */
export interface ScannedField {
  meta: FieldMeta;
  classification: FieldClassification;
}

export interface ScannedForm {
  ref: string;
  fields: ScannedField[];
  target?: RequestTarget | undefined;
}

export interface ScanInput {
  siteUrl: string;
  forms: ScannedForm[];
}

export interface CategoryCount {
  category: FieldCategory;
  /** Bu kategoriyi toplayan form sayısı. */
  forms: number;
}

export interface Destination {
  origin: string;
  forms: number;
  sameOrigin: boolean;
}

export type RiskKind = "cross-origin-target" | "get-with-sensitive";

export interface RiskFlag {
  formRef: string;
  kind: RiskKind;
  detail: string;
}

export interface ReviewItem {
  formRef: string;
  fieldName?: string | undefined;
  category: FieldCategory;
  confidence: number;
  reason: string;
}

/** Form düzeyi özet — değişiklik uyarısı ve insan onay döngüsünün zemini. */
export interface ReportForm {
  ref: string;
  fields: Array<{ name: string; category: FieldCategory }>;
}

export interface FormInventoryReport {
  siteOrigin: string;
  formCount: number;
  fieldCount: number;
  categoryCounts: CategoryCount[];
  destinations: Destination[];
  riskFlags: RiskFlag[];
  review: ReviewItem[];
  forms: ReportForm[];
}
