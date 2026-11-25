import pg from "pg";
import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import { computeDeadline, extendDeadline } from "../dsar/deadline.js";
import type { DsarRequest, DsarStatus, DsarType } from "../dsar/types.js";
import type { FormInventoryReport } from "../report/types.js";
import type { Correction } from "./corrections.js";
import type { AuditEntry } from "./types.js";
import type { ApiKeyRecord } from "./api-keys.js";
import { hashApiKey } from "./api-keys.js";
import {
  makeChainEntry,
  verifyReceiptSelfHash,
  verifyStoredChain,
  type StoredReceiptEntry,
} from "./chain.js";
import type { PanelStore } from "./store.js";
import type { Client, ContactPackage, ContactRequest, PanelUser, PlanChangeRequest, ScanCookie, ScannedScript, Site, SiteBannerConfig, StoredScan, Tenant, TenantKind } from "./types.js";
import { deepClone, randomIngestToken } from "./shared.js";

/**
 * PanelStore portunun gerçek Postgres adapter'ı — src/panel/migrations üstünde.
 * In-memory adapter ile birebir aynı sözleşmeyi uygular. Dönen her nesne derin kopyadır.
 *
 * Kiracı izolasyonu iki katta: PanelService sahiplik guard'ları ve veritabanında
 * RLS. tenantId alan metotlar asTenant ile koşar: işlem boyunca bağlantı
 * veriform_app rolüne geçer (migration 009) ve app.current_tenant ayarlanır,
 * böylece başka kiracının satırı WHERE'siz sorgularda bile görünmez. Sistem
 * yolları (ingest anahtarı, zamanlayıcı, operatör, hesap belirteci) havuzun
 * sahibi olarak kalır — kiracı filtresi yoktur.
 */

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

function mapTenant(row: pg.QueryResultRow): Tenant {
  return {
    id: String(row.id),
    name: String(row.name),
    kind: row.kind as TenantKind,
    package: row.package as Tenant["package"],
    ...(row.trial_ends_at ? { trialEndsAt: iso(row.trial_ends_at as Date) } : {}),
    ...(row.brand_color ? { brandColor: String(row.brand_color) } : {}),
    ...(row.brand_logo_url ? { brandLogoUrl: String(row.brand_logo_url) } : {}),
    createdAt: iso(row.created_at as Date),
  };
}

function mapPlanChangeRequest(row: pg.QueryResultRow): PlanChangeRequest {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    fromPackage: row.from_package as PlanChangeRequest["fromPackage"],
    toPackage: row.to_package as PlanChangeRequest["toPackage"],
    status: row.status as PlanChangeRequest["status"],
    createdAt: iso(row.created_at as Date),
    ...(row.decided_at ? { decidedAt: iso(row.decided_at as Date) } : {}),
  };
}

function mapClient(row: pg.QueryResultRow): Client {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    ...(row.brand_color ? { brandColor: String(row.brand_color) } : {}),
    ...(row.brand_logo_url ? { brandLogoUrl: String(row.brand_logo_url) } : {}),
    createdAt: iso(row.created_at as Date),
  };
}

function mapSite(row: pg.QueryResultRow): Site {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    url: String(row.url),
    ingestToken: String(row.ingest_token),
    ...(row.banner_config ? { bannerConfig: row.banner_config as SiteBannerConfig } : {}),
    ...(row.scan_interval_hours !== null && row.scan_interval_hours !== undefined
      ? { scanIntervalHours: Number(row.scan_interval_hours) }
      : {}),
    ...(row.embed_last_seen_at ? { embedLastSeenAt: iso(row.embed_last_seen_at as Date) } : {}),
    createdAt: iso(row.created_at as Date),
  };
}

function mapScan(row: pg.QueryResultRow): StoredScan {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    scannedAt: iso(row.scanned_at as Date),
    report: row.report as FormInventoryReport,
    cookies: row.cookies as ScanCookie[],
    observedTargets: row.observed_targets as RequestTarget[],
    scripts: row.scripts as ScannedScript[],
  };
}

function mapUser(row: pg.QueryResultRow): PanelUser {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    role: row.role as PanelUser["role"],
    ...(row.email_verified_at ? { emailVerifiedAt: iso(row.email_verified_at as Date) } : {}),
    sessionsValidAfter: iso(row.sessions_valid_after as Date),
    createdAt: iso(row.created_at as Date),
  };
}

function mapApiKey(row: pg.QueryResultRow): ApiKeyRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    prefix: String(row.prefix),
    ...(row.revoked_at ? { revokedAt: iso(row.revoked_at as Date) } : {}),
    ...(row.last_used_at ? { lastUsedAt: iso(row.last_used_at as Date) } : {}),
    createdAt: iso(row.created_at as Date),
  };
}

function mapDsar(row: pg.QueryResultRow): DsarRequest {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    type: row.type as DsarType,
    subjectName: String(row.subject_name),
    subjectEmail: String(row.subject_email),
    ...(row.message ? { message: String(row.message) } : {}),
    receivedAt: iso(row.received_at as Date),
    deadlineAt: iso(row.deadline_at as Date),
    status: row.status as DsarStatus,
    extended: Boolean(row.extended),
    ...(row.responded_at ? { respondedAt: iso(row.responded_at as Date) } : {}),
    ...(row.response_note ? { responseNote: String(row.response_note) } : {}),
  };
}

function mapContact(row: pg.QueryResultRow): ContactRequest {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    ...(row.company ? { company: String(row.company) } : {}),
    ...(row.package ? { package: row.package as ContactRequest["package"] } : {}),
    message: String(row.message),
    ...(row.handled_at ? { handledAt: iso(row.handled_at as Date) } : {}),
    createdAt: iso(row.created_at as Date),
  };
}

type Query = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>;

export interface PostgresPanelStore extends PanelStore {
  close(): Promise<void>;
}

export function createPostgresPanelStore(connectionString: string): PostgresPanelStore {
  const pool = new pg.Pool({ connectionString });
  // "VFSC" — tarama turları arası tekilleştirme anahtarı (migration kilitlerinden ayrı).
  const SCHEDULER_LOCK_KEY = 0x56465343;

  const clone = deepClone;

  // SET LOCAL ROLE işlemle sınırlıdır: commit/rollback bağlantıyı havuz sahibine döndürür.
  async function asTenant<T>(tenantId: string, fn: (q: Query) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    let broken = false;
    try {
      await client.query("begin; set local role veriform_app");
      await client.query("select set_config('app.current_tenant', $1, true)", [tenantId]);
      const result = await fn((sql, params) => client.query(sql, params));
      await client.query("commit");
      return result;
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        broken = true;
      }
      throw error;
    } finally {
      client.release(broken);
    }
  }

  return {
    async ping() {
      await pool.query("select 1");
    },

    async withSchedulerLock(work) {
      // Oturum düzeyi advisory lock: kilidi tutan bağlantı work boyunca elde kalır.
      const client = await pool.connect();
      let acquired = false;
      let broken = false;
      try {
        const lock = await client.query("select pg_try_advisory_lock($1)", [SCHEDULER_LOCK_KEY]);
        acquired = lock.rows[0]!.pg_try_advisory_lock === true;
        if (!acquired) return null;
        return await work();
      } finally {
        if (acquired) {
          try {
            await client.query("select pg_advisory_unlock($1)", [SCHEDULER_LOCK_KEY]);
          } catch {
            broken = true;
          }
        }
        client.release(broken);
      }
    },

    async createTenant(input) {
      const result = await pool.query(
        "insert into tenants (name, kind, package, trial_ends_at, brand_color, brand_logo_url) values ($1, $2, $3, $4, $5, $6) returning *",
        [input.name, input.kind, input.package ?? "starter", input.trialEndsAt ?? null, input.brandColor ?? null, input.brandLogoUrl ?? null],
      );
      return clone(mapTenant(result.rows[0]!));
    },

    async getTenant(tenantId) {
      return asTenant(tenantId, async (q) => {
        const result = await q("select * from tenants where id = $1", [tenantId]);
        return result.rows[0] ? clone(mapTenant(result.rows[0])) : null;
      });
    },

    async countSitesByTenant(tenantId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          `select count(*)::int as n
           from sites s join clients c on c.id = s.client_id
           where c.tenant_id = $1`,
          [tenantId],
        );
        return Number(result.rows[0]!.n);
      });
    },

    async createClient(input) {
      return asTenant(input.tenantId, async (q) => {
        const tenant = await q("select 1 from tenants where id = $1", [input.tenantId]);
        if (tenant.rowCount === 0) throw new Error(`tenant bulunamadı: ${input.tenantId}`);
        const result = await q(
          "insert into clients (tenant_id, name) values ($1, $2) returning *",
          [input.tenantId, input.name],
        );
        return clone(mapClient(result.rows[0]!));
      });
    },

    async listClients(tenantId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select * from clients where tenant_id = $1 order by created_at, id",
          [tenantId],
        );
        return clone(result.rows.map(mapClient));
      });
    },

    async deleteClient(tenantId, clientId) {
      await asTenant(tenantId, async (q) => {
        // FK cascade: sites/scans/receipts/dsars on delete cascade
        const result = await q("delete from clients where id = $1", [clientId]);
        if (result.rowCount === 0) throw new Error(`client bulunamadı: ${clientId}`);
      });
    },

    async setClientBranding(tenantId, clientId, input) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "update clients set brand_color = $2, brand_logo_url = $3 where id = $1 returning *",
          [clientId, input.brandColor ?? null, input.brandLogoUrl ?? null],
        );
        if (result.rowCount === 0) throw new Error(`client bulunamadı: ${clientId}`);
        return clone(mapClient(result.rows[0]!));
      });
    },

    async createSite(input) {
      return asTenant(input.tenantId, async (q) => {
        const client = await q("select 1 from clients where id = $1", [input.clientId]);
        if (client.rowCount === 0) throw new Error(`client bulunamadı: ${input.clientId}`);
        const token = [...crypto.getRandomValues(new Uint8Array(32))]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const result = await q(
          "insert into sites (client_id, url, ingest_token) values ($1, $2, $3) returning *",
          [input.clientId, input.url, token],
        );
        return clone(mapSite(result.rows[0]!));
      });
    },

    async getSite(tenantId, siteId) {
      return asTenant(tenantId, async (q) => {
        const result = await q("select * from sites where id = $1", [siteId]);
        return result.rows[0] ? clone(mapSite(result.rows[0])) : null;
      });
    },

    async listAllSites() {
      const result = await pool.query("select * from sites order by created_at, id");
      return clone(result.rows.map(mapSite));
    },

    async getSiteByToken(token) {
      const result = await pool.query("select * from sites where ingest_token = $1", [token]);
      return result.rows[0] ? clone(mapSite(result.rows[0])) : null;
    },

    async markEmbedSeen(siteId) {
      await pool.query("update sites set embed_last_seen_at = now() where id = $1", [siteId]);
    },

    async setBannerConfig(tenantId, siteId, config) {
      return asTenant(tenantId, async (q) => {
        const site = await q("select 1 from sites where id = $1", [siteId]);
        if (site.rowCount === 0) throw new Error(`site bulunamadı: ${siteId}`);
        const result = await q(
          "update sites set banner_config = $2 where id = $1 returning *",
          [siteId, config ? JSON.stringify(config) : null],
        );
        return clone(mapSite(result.rows[0]!));
      });
    },

    async setScanSchedule(tenantId, siteId, intervalHours) {
      return asTenant(tenantId, async (q) => {
        const site = await q("select 1 from sites where id = $1", [siteId]);
        if (site.rowCount === 0) throw new Error(`site bulunamadı: ${siteId}`);
        const result = await q(
          "update sites set scan_interval_hours = $2 where id = $1 returning *",
          [siteId, intervalHours > 0 ? intervalHours : null],
        );
        return clone(mapSite(result.rows[0]!));
      });
    },

    async listSites(tenantId, clientId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select * from sites where client_id = $1 order by created_at, id",
          [clientId],
        );
        return clone(result.rows.map(mapSite));
      });
    },

    async saveScan(input) {
      const site = await pool.query("select 1 from sites where id = $1", [input.siteId]);
      if (site.rowCount === 0) throw new Error(`site bulunamadı: ${input.siteId}`);
      const result = await pool.query(
        "insert into scans (site_id, report, cookies, observed_targets) values ($1, $2, $3, $4) returning *",
        [
          input.siteId,
          JSON.stringify(input.report),
          JSON.stringify(input.cookies),
          JSON.stringify(input.observedTargets),
        ],
      );
      return clone(mapScan(result.rows[0]!));
    },

    async listScans(tenantId, siteId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select * from scans where site_id = $1 order by scanned_at, id",
          [siteId],
        );
        return clone(result.rows.map(mapScan));
      });
    },

    async listAllScans(siteId) {
      const result = await pool.query(
        "select * from scans where site_id = $1 order by scanned_at, id",
        [siteId],
      );
      return clone(result.rows.map(mapScan));
    },

    async appendReceipt(input) {
      const site = await pool.query("select 1 from sites where id = $1", [input.siteId]);
      if (site.rowCount === 0) throw new Error(`site bulunamadı: ${input.siteId}`);
      if (!(await verifyReceiptSelfHash(input.receipt))) {
        throw new Error("selfHash doğrulaması başarısız — kanıt kurcalanmış olabilir");
      }
      // Zincir bütünlüğü: site başına advisory lock ile "son bağ oku → ekle"
      // işlemini serileştiririz — eşzamanlı kabuller zinciri çatallayamaz.
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
          input.siteId,
        ]);
        const last = await client.query(
          "select chain_hash from consent_receipts where site_id = $1 order by received_at desc, id desc limit 1",
          [input.siteId],
        );
        const prevChainHash = last.rows[0] ? String(last.rows[0].chain_hash) : undefined;
        const entry = await makeChainEntry(input.siteId, input.receipt, prevChainHash);
        await client.query(
          "insert into consent_receipts (id, site_id, received_at, receipt, prev_chain_hash, chain_hash) values ($1, $2, $3, $4, $5, $6)",
          [
            entry.id,
            entry.siteId,
            entry.receivedAt,
            JSON.stringify(entry.receipt),
            entry.prevChainHash,
            entry.chainHash,
          ],
        );
        await client.query("commit");
        return clone(entry);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async verifySiteChain(tenantId, siteId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select * from consent_receipts where site_id = $1 order by received_at, id",
          [siteId],
        );
        const entries: StoredReceiptEntry[] = result.rows.map((row) => ({
          id: String(row.id),
          siteId: String(row.site_id),
          receivedAt: iso(row.received_at as Date),
          receipt: row.receipt as ConsentReceipt,
          prevChainHash: String(row.prev_chain_hash),
          chainHash: String(row.chain_hash),
        }));
        return verifyStoredChain(entries);
      });
    },

    async createUser(input) {
      try {
        const result = await pool.query(
          "insert into users (tenant_id, email, password_hash) values ($1, $2, $3) returning *",
          [input.tenantId, input.email, input.passwordHash],
        );
        return clone(mapUser(result.rows[0]!));
      } catch (error) {
        // Postgres benzersizlik ihlali (23505) → port sözleşmesindeki mesaj
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505") {
          throw new Error("e-posta zaten kayıtlı");
        }
        throw error;
      }
    },

    async invalidateSessions(userId) {
      const result = await pool.query(
        "update users set sessions_valid_after = $2 where id = $1",
        [userId, new Date().toISOString()],
      );
      if (result.rowCount === 0) throw new Error(`kullanıcı bulunamadı: ${userId}`);
    },

    async findUserByEmail(email) {
      const result = await pool.query("select * from users where email = $1", [email]);
      return result.rows[0] ? clone(mapUser(result.rows[0])) : null;
    },

    async findUserByTenant(tenantId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select * from users where tenant_id = $1 order by created_at, id limit 1",
          [tenantId],
        );
        return result.rows[0] ? clone(mapUser(result.rows[0])) : null;
      });
    },

    async setUserEmailVerified(userId) {
      const result = await pool.query("update users set email_verified_at = now() where id = $1", [userId]);
      if (result.rowCount === 0) throw new Error(`kullanıcı bulunamadı: ${userId}`);
    },

    async updateUserPassword(userId, passwordHash) {
      const result = await pool.query("update users set password_hash = $1 where id = $2", [
        passwordHash,
        userId,
      ]);
      if (result.rowCount === 0) throw new Error(`kullanıcı bulunamadı: ${userId}`);
    },

    async deleteTenant(tenantId) {
      const result = await pool.query("delete from tenants where id = $1", [tenantId]);
      if (result.rowCount === 0) throw new Error(`tenant bulunamadı: ${tenantId}`);
    },

    async createAccountToken(input) {
      await pool.query(
        "insert into account_tokens (user_id, purpose, token_hash, expires_at) values ($1, $2, $3, $4)",
        [input.userId, input.purpose, input.tokenHash, input.expiresAt],
      );
    },

    async consumeAccountToken(tokenHash, purpose) {
      // Tek atomik update: hedef token'ı ve aynı kullanıcı+amaçtaki diğer bekleyen tokenları
      // birlikte kapatır. Eşzamanlı iki istekten yalnız biri hedefi tüketebilir.
      const result = await pool.query(
        "update account_tokens set used_at = now() where purpose = $2 and used_at is null and user_id in (select user_id from account_tokens where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now()) returning user_id, token_hash",
        [tokenHash, purpose],
      );
      const consumed = result.rows.find((row) => String(row.token_hash) === tokenHash);
      return consumed ? { userId: String(consumed.user_id) } : null;
    },

    async createContactRequest(input) {
      const result = await pool.query(
        "insert into contact_requests (name, email, company, package, message) values ($1, $2, $3, $4, $5) returning *",
        [input.name, input.email, input.company ?? null, input.package ?? null, input.message],
      );
      return clone(mapContact(result.rows[0]!));
    },

    async listContactRequests() {
      const result = await pool.query("select * from contact_requests order by created_at, id");
      return clone(result.rows.map(mapContact));
    },

    async setContactHandled(id, handled) {
      const result = await pool.query(
        "update contact_requests set handled_at = $1 where id = $2",
        [handled ? new Date() : null, id],
      );
      if (result.rowCount === 0) throw new Error(`talep bulunamadı: ${id}`);
    },

    async listTenants() {
      const result = await pool.query("select * from tenants order by created_at, id");
      return clone(result.rows.map(mapTenant));
    },

    async setTenantPackage(tenantId, pkg) {
      const result = await pool.query(
        "update tenants set package = $1, trial_ends_at = null where id = $2",
        [pkg, tenantId],
      );
      if (result.rowCount === 0) throw new Error(`tenant bulunamadı: ${tenantId}`);
    },

    async createPlanChangeRequest(input) {
      return asTenant(input.tenantId, async (q) => {
        const tenant = await q("select package from tenants where id = $1", [input.tenantId]);
        if (tenant.rowCount === 0) throw new Error(`tenant bulunamadı: ${input.tenantId}`);
        const fromPackage = tenant.rows[0]!.package as ContactPackage;
        if (fromPackage === input.toPackage) throw new Error("zaten bu pakettesiniz");
        const result = await q(
          `insert into plan_change_requests (tenant_id, from_package, to_package)
           values ($1, $2, $3)
           on conflict (tenant_id) where status = 'pending' do nothing
           returning *`,
          [input.tenantId, fromPackage, input.toPackage],
        );
        if (result.rowCount === 0) throw new Error("zaten bekleyen bir geçiş talebiniz var");
        return clone(mapPlanChangeRequest(result.rows[0]!));
      });
    },

    async listPlanChangeRequests(tenantId) {
      // tenantId yoksa operatör listesi: sistem yolu, kiracı filtresi yok
      if (!tenantId) {
        const result = await pool.query(
          "select * from plan_change_requests order by created_at desc, id desc",
        );
        return clone(result.rows.map(mapPlanChangeRequest));
      }
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select * from plan_change_requests where tenant_id = $1 order by created_at desc, id desc",
          [tenantId],
        );
        return clone(result.rows.map(mapPlanChangeRequest));
      });
    },

    async decidePlanChangeRequest(id, decision) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const existing = await client.query("select * from plan_change_requests where id = $1", [id]);
        if (existing.rowCount === 0) throw new Error(`talep bulunamadı: ${id}`);
        if (existing.rows[0]!.status !== "pending") throw new Error("talep zaten sonuçlanmış");
        const updated = await client.query(
          "update plan_change_requests set status = $1, decided_at = now() where id = $2 and status = 'pending' returning *",
          [decision, id],
        );
        if (updated.rowCount === 0) throw new Error("talep zaten sonuçlanmış");
        const req = mapPlanChangeRequest(updated.rows[0]!);
        if (decision === "approved") {
          await client.query(
            "update tenants set package = $1, trial_ends_at = null where id = $2",
            [req.toPackage, req.tenantId],
          );
        }
        await client.query("commit");
        return clone(req);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async saveDsar(input) {
      const site = await pool.query("select 1 from sites where id = $1", [input.siteId]);
      if (site.rowCount === 0) throw new Error(`site bulunamadı: ${input.siteId}`);
      const receivedAt = input.receivedAt ?? new Date().toISOString();
      const result = await pool.query(
        "insert into dsar_requests (site_id, type, subject_name, subject_email, message, received_at, deadline_at) values ($1, $2, $3, $4, $5, $6, $7) returning *",
        [
          input.siteId,
          input.type,
          input.subjectName,
          input.subjectEmail,
          input.message ?? null,
          receivedAt,
          computeDeadline(receivedAt),
        ],
      );
      return clone(mapDsar(result.rows[0]!));
    },

    async listDsars(tenantId, siteId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select * from dsar_requests where site_id = $1 order by received_at, id",
          [siteId],
        );
        return clone(result.rows.map(mapDsar));
      });
    },

    async updateDsar(tenantId, siteId, dsarId, patch) {
      return asTenant(tenantId, async (q) => {
        const current = await q(
          "select * from dsar_requests where id = $1 and site_id = $2",
          [dsarId, siteId],
        );
        if (current.rowCount === 0) throw new Error(`başvuru bulunamadı: ${dsarId}`);
        const row = current.rows[0]!;

        let deadlineAt = iso(row.deadline_at as Date);
        let extended = Boolean(row.extended);
        if (patch.extend) {
          if (extended) throw new Error("süre zaten uzatılmış — KVKK m.13 tek uzatma hakkı verir");
          deadlineAt = extendDeadline(deadlineAt);
          extended = true;
        }
        let status = row.status as DsarStatus;
        if (patch.status) status = patch.status;
        const respondedAt =
          status === "completed" || status === "rejected"
            ? new Date().toISOString()
            : row.responded_at
              ? iso(row.responded_at as Date)
              : null;
        const responseNote =
          patch.responseNote !== undefined ? patch.responseNote : (row.response_note as string | null);

        const updated = await q(
          "update dsar_requests set deadline_at = $2, extended = $3, status = $4, responded_at = $5, response_note = $6 where id = $1 and site_id = $7 returning *",
          [dsarId, deadlineAt, extended, status, respondedAt, responseNote, siteId],
        );
        return clone(mapDsar(updated.rows[0]!));
      });
    },

    async listReceipts(tenantId, siteId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select * from consent_receipts where site_id = $1 order by received_at, id",
          [siteId],
        );
        return clone(
          result.rows.map((row) => ({
            id: String(row.id),
            siteId: String(row.site_id),
            receivedAt: iso(row.received_at as Date),
            receipt: row.receipt as ConsentReceipt,
            prevChainHash: String(row.prev_chain_hash),
            chainHash: String(row.chain_hash),
          })),
        );
      });
    },

    async saveCorrection(tenantId, siteId, input) {
      await asTenant(tenantId, async (q) => {
        const site = await q("select 1 from sites where id = $1", [siteId]);
        if (site.rowCount === 0) throw new Error(`site bulunamadı: ${siteId}`);
        await q(
          "insert into corrections (site_id, field_name, category) values ($1, $2, $3) on conflict (site_id, field_name) do update set category = excluded.category",
          [siteId, input.fieldName, input.category],
        );
      });
      return { fieldName: input.fieldName, category: input.category as Correction["category"] };
    },

    async listCorrections(tenantId, siteId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select field_name, category from corrections where site_id = $1 order by created_at, id",
          [siteId],
        );
        return clone(
          result.rows.map((row) => ({
            fieldName: String(row.field_name),
            category: String(row.category) as Correction["category"],
          })),
        );
      });
    },

    async listAllCorrections(siteId) {
      const result = await pool.query(
        "select field_name, category from corrections where site_id = $1 order by created_at, id",
        [siteId],
      );
      return clone(
        result.rows.map((row) => ({
          fieldName: String(row.field_name),
          category: String(row.category) as Correction["category"],
        })),
      );
    },

    async recordAudit(tenantId, action, detail) {
      await asTenant(tenantId, (q) =>
        q("insert into audit_log (tenant_id, action, detail) values ($1, $2, $3)", [
          tenantId,
          action,
          JSON.stringify(detail ?? {}),
        ]),
      );
    },

    async listAudit(tenantId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select * from audit_log where tenant_id = $1 order by created_at, id",
          [tenantId],
        );
        return clone(
          result.rows.map((row) => ({
            id: String(row.id),
            tenantId: String(row.tenant_id),
            action: String(row.action),
            detail: row.detail as Record<string, unknown>,
            createdAt: iso(row.created_at as Date),
          })),
        );
      });
    },

    async saveApiKey(tenantId, input) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "insert into api_keys (tenant_id, name, prefix, key_hash) values ($1, $2, $3, $4) returning *",
          [tenantId, input.name, input.prefix, input.keyHash],
        );
        return clone(mapApiKey(result.rows[0]!));
      });
    },

    async listApiKeys(tenantId) {
      return asTenant(tenantId, async (q) => {
        const result = await q(
          "select * from api_keys where tenant_id = $1 order by created_at, id",
          [tenantId],
        );
        return clone(result.rows.map(mapApiKey));
      });
    },

    async revokeApiKey(tenantId, keyId) {
      await asTenant(tenantId, async (q) => {
        const result = await q(
          "update api_keys set revoked_at = now() where tenant_id = $1 and id = $2 and revoked_at is null",
          [tenantId, keyId],
        );
        if (result.rowCount === 0) throw new Error(`API anahtarı bulunamadı: ${keyId}`);
      });
    },

    async findTenantByApiKey(key) {
      const hash = hashApiKey(key);
      const result = await pool.query(
        "select * from api_keys where key_hash = $1 and revoked_at is null",
        [hash],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0]!;
      await pool.query("update api_keys set last_used_at = now() where id = $1", [row.id]);
      return { tenantId: String(row.tenant_id), keyId: String(row.id) };
    },

    async touchApiKey(key) {
      await pool.query(
        "update api_keys set last_used_at = now() where key_hash = $1",
        [hashApiKey(key)],
      );
    },

    async getSiteAlertContext(siteId) {
      const result = await pool.query(
        `select s.url as site_url, c.tenant_id as tenant_id, u.email as owner_email
         from sites s
         join clients c on c.id = s.client_id
         join users u on u.tenant_id = c.tenant_id and u.role = 'owner'
         where s.id = $1`,
        [siteId],
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0]!;
      return {
        tenantId: String(row.tenant_id),
        ownerEmail: String(row.owner_email),
        siteUrl: String(row.site_url),
      };
    },

    async close() {
      await pool.end();
    },
  };
}
