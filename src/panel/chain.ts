import { canonicalJson, GENESIS_HASH, sha256Hex, type ConsentReceipt } from "../consent/receipt.js";

/**
 * Sunucu tarafı kanıt zinciri.
 * Tarayıcıdan gelen her rıza kanıtı (client receipt) bağımsız bir attestasyondur
 * (selfHash karar+metne bağlıdır); sunucu bunları varış sırasına göre kendi
 * zincirine ekler: her kayıt, önceki sunucu kaydının chainHash'ine bağlanır.
 * Böylece hem tek tek attestasyonlar hem de sunucudaki sıralama kurcalamaya
 * karşı matematiksel olarak doğrulanabilir.
 */

export interface StoredReceiptEntry {
  id: string;
  siteId: string;
  receivedAt: string;
  receipt: ConsentReceipt;
  prevChainHash: string;
  chainHash: string;
}

export async function verifyReceiptSelfHash(receipt: ConsentReceipt): Promise<boolean> {
  const { selfHash, ...rest } = receipt;
  return (await sha256Hex(canonicalJson(rest))) === selfHash;
}

export async function makeChainEntry(
  siteId: string,
  receipt: ConsentReceipt,
  prevChainHash?: string,
): Promise<StoredReceiptEntry> {
  const prev = prevChainHash ?? GENESIS_HASH;
  const chainHash = await sha256Hex(
    canonicalJson({ receipt, prevChainHash: prev }),
  );
  return {
    id: crypto.randomUUID(),
    siteId,
    receivedAt: new Date().toISOString(),
    receipt,
    prevChainHash: prev,
    chainHash,
  };
}

export async function verifyStoredChain(entries: readonly StoredReceiptEntry[]): Promise<boolean> {
  let prev = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevChainHash !== prev) return false;
    if (!(await verifyReceiptSelfHash(entry.receipt))) return false;
    const expected = await sha256Hex(
      canonicalJson({ receipt: entry.receipt, prevChainHash: entry.prevChainHash }),
    );
    if (expected !== entry.chainHash) return false;
    prev = entry.chainHash;
  }
  return true;
}

/** CSV hücresi: tırnak içine al, içteki tırnakları çiftle. */
function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/** Kanıt zincirini denetim için CSV'ye ihraç eder (RFC 4180 uyumlu kaçırma). */
export function receiptsToCsv(entries: readonly StoredReceiptEntry[]): string {
  const header = "id,received_at,site_id,site,self_hash,prev_chain_hash,chain_hash\n";
  const rows = entries
    .map(
      (e) =>
        [
          csvCell(e.id),
          csvCell(e.receivedAt),
          csvCell(e.siteId),
          csvCell(e.receipt.site),
          csvCell(e.receipt.selfHash),
          csvCell(e.prevChainHash),
          csvCell(e.chainHash),
        ].join(","),
    )
    .join("\n");
  return header + (rows ? rows + "\n" : "");
}
