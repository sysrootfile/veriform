/** Değer içinden tespit edilebilen kişisel veri kategorileri (v0). */
export type ValueCategory = "tckn" | "iban" | "card" | "phone" | "email";

/** Alan meta verisinden sınıflandırılabilen kategoriler (değer kategorileri dahil). */
export type FieldCategory =
  | ValueCategory
  | "full_name"
  | "birthdate"
  | "address"
  | "passport"
  | "free_text";

/** Form alanının değer içermeyen meta verisi (embed script bundan fazlasını iletmez). */
export interface FieldMeta {
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  type?: string;
  autocomplete?: string;
  required?: boolean;
}

export interface FieldClassification {
  category: FieldCategory;
  /** 0–1 arası güven; kural tabanlı v0'da kuralın önceden tanımlı ağırlığı. */
  confidence: number;
  /** Kararı destekleyen sinyaller, örn. "type:email", "text:eposta". */
  signals: string[];
}
