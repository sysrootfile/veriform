import { runScheduledScans, type SchedulerRunOptions } from "../scanner/scheduler-run.js";
import type { EmailSender } from "./mailer.js";
import { verifyWorkerToken } from "./secrets.js";
import type { PanelStore } from "./store.js";

/**
 * /internal/run-scheduled işleyicisi — server.ts glue'u buraya delege eder.
 * Tur, dahili setInterval döngüsüyle aynı notifier bağlantısıyla çalışır:
 * değişiklik uyarısı mailSender'a gider (cron modelinde de e-posta çıkar).
 */

export interface WorkerRunDeps {
  store: PanelStore;
  workerToken: string | null;
  mailSender: EmailSender;
  /** Test enjeksiyonu — scheduler-run'ın tarayıcı/zaman seam'leri. */
  scan?: SchedulerRunOptions["scan"];
  now?: SchedulerRunOptions["now"];
}

export interface WorkerRunResult {
  status: number;
  json: unknown;
}

export async function handleWorkerRun(
  deps: WorkerRunDeps,
  presentedToken: string | undefined,
): Promise<WorkerRunResult> {
  if (!verifyWorkerToken(presentedToken, deps.workerToken)) {
    return { status: 403, json: { error: "geçersiz worker token'ı" } };
  }
  try {
    const outcome = await runScheduledScans(deps.store, {
      notifier: async (email) => {
        await deps.mailSender.send(email);
      },
      ...(deps.scan ? { scan: deps.scan } : {}),
      ...(deps.now ? { now: deps.now } : {}),
    });
    return {
      status: 200,
      json: {
        scanned: outcome.scanned.length,
        failed: outcome.failed.length,
        notified: outcome.notified.length,
      },
    };
  } catch (error) {
    console.error("[worker] tarama turu hatası:", error);
    return { status: 500, json: { error: "tarama turu başarısız" } };
  }
}