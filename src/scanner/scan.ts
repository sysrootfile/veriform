import { build } from "esbuild";
import { classifyCookie, type CookieCategory } from "../cookies/classify.js";
import { classifyScript, type ScriptCategory } from "./scripts.js";
import type { RequestTarget } from "../collector/targets.js";
import type { FormInventoryReport } from "../report/types.js";
import { getSharedBrowser } from "./browser.js";

/**
 * Sunucu tarafı tarama: embed kaynağını gerçek bir headless tarayıcıya
 * enjekte eder, sayfayı yükler, raporu ve canlı hedef gözlemini toplar.
 * Dış ağa bağımlı değildir — hedef URL çağıranın verdiği herhangi bir adrestir.
 */

export interface ScanOptions {
  /** IIFE embed kaynağı (bkz. buildEmbedSource). */
  embedSource: string;
  /** Yükleme sonrası gözlem bekleme süresi (ms). */
  settleMs?: number;
  timeoutMs?: number;
}

export interface ScannedCookie {
  name: string;
  domain: string;
  category: CookieCategory;
}

export interface ScannedScript {
  url: string;
  category: ScriptCategory;
}

export interface ScanResult {
  url: string;
  finalUrl: string;
  report: FormInventoryReport;
  observedTargets: RequestTarget[];
  /** Tarama sırasında (rıza ÖNCESİ) atılmış çerezler — sınıflandırılmış. */
  cookies: ScannedCookie[];
  /** Sayfada yüklenen scriptler — first-party/üçüncü taraf envanteri. */
  scripts: ScannedScript[];
}

let sourcePromise: Promise<string> | undefined;

/** Embed paket kaynağını esbuild API'siyle üretir (sonuç önbelleklenir). */
export function buildEmbedSource(): Promise<string> {
  sourcePromise ??= build({
    entryPoints: ["src/embed/main.ts"],
    bundle: true,
    format: "iife",
    target: "es2020",
    write: false,
    logLevel: "silent",
  }).then((result) => result.outputFiles![0]!.text);
  return sourcePromise;
}

export async function scanSite(url: string, options: ScanOptions): Promise<ScanResult> {
  const browser = await getSharedBrowser();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.addInitScript(options.embedSource);
    await page.goto(url, { waitUntil: "load", timeout: options.timeoutMs ?? 30_000 });
    await page.waitForTimeout(options.settleMs ?? 400);

    const data = await page.evaluate(() => {
      const v = (
        window as unknown as {
          __veriform?: { getReport(): unknown; getObservedTargets(): unknown[] };
        }
      ).__veriform;
      return v ? { report: v.getReport(), observedTargets: v.getObservedTargets() } : null;
    });
    if (!data) {
      throw new Error(`Veriform embed sayfada başlatılamadı: ${url}`);
    }

    const cookies = (await context.cookies()).map((c) => ({
      name: c.name,
      domain: c.domain,
      category: classifyCookie(c.name),
    }));

    // Script envanteri: sayfada yüklenen tüm harici scriptler (rıza ÖNCESİ gözlem)
    const scripts = (await page.evaluate(() =>
      [...document.querySelectorAll("script[src]")]
        .map((s) => (s as HTMLScriptElement).src)
        .filter((src) => src && !src.startsWith("data:")),
    )).map((src) => ({ url: src, category: classifyScript(src, url) }));

    return {
      url,
      finalUrl: page.url(),
      report: data.report as FormInventoryReport,
      observedTargets: data.observedTargets as RequestTarget[],
      cookies,
      scripts,
    };
  } finally {
    await context.close();
  }
}
