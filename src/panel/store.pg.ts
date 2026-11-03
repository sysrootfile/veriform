import pg from "pg";
import type { RequestTarget } from "../collector/targets.js";
import type { ConsentReceipt } from "../consent/receipt.js";
import { computeDeadline, extendDeadline } from "../dsar/deadline.js";
import type { DsarRequest, DsarStatus, DsarType } from "../dsar/types.js";
import type { FormInventoryReport } from "../report/types.js";
import type { Correction } from "./corrections.js";
import type { AuditEntry } from "./types.js";
import {
  makeChainEntry,
  verifyReceiptSelfHash,
  verifyStoredChain,
  type StoredReceiptEntry,
} from "./chain.js";
import type { PanelStore } from "./store.js";
import type { Client, PanelUser, ScanCookie, Site, SiteBannerConfig, StoredScan, Tenant, TenantKind } from "./types.js";
import { deepClone, randomIngestToken } from "./shared.js";

/**
 * PanelStore portunun gerçek Postgres adapter'ı — src/panel/schema.sql üstünde.
 * In-memory adapter ile birebir aynı sözleşmeyi uygular; kiracı izolasyonu
 * DB düzeyinde RLS ile (app.current_tenant), uygulama düzeyinde PanelService
 * sahiplik guard'ları ile sağlanır. Dönen her nesne derin kopyadır.
 */

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

function mapTenant(row: pg.QueryResultRow): Tenant {
  return {
    id: String(row.id),
    name: String(row.name),
    kind: row.kind as TenantKind,
    ...(row.brand_color ? { brandColor: String(row.brand_color) } : {}),
    ...(row.brand_logo_url ? { brandLogoUrl: String(row.brand_logo_url) } : {}),
    createdAt: iso(row.created_at as Date),
  };
}

function mapClient(row: pg.QueryResultRow): Client {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
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
  };
}

function mapUser(row: pg.QueryResultRow): PanelUser {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    role: row.role as PanelUser["role"],
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

export interface PostgresPanelStore extends PanelStore {
  close(): Promise<void>;
}

export function createPostgresPanelStore(connectionString: string): PostgresPanelStore {
  const pool = new pg.Pool({ connectionString });

  const clone = deepClone;

  async function requireClient(clientId: string): Promise<void> {
    const result = await pool.query("select 1 from clients where id = $1", [clientId]);
    if (result.rowCount === 0) throw new Error(`client bulunamadı: ${clientId}`);
  }

  return {
    async createTenant(input) {
      const result = await pool.query(
        "insert into tenants (name, kind, brand_color, brand_logo_url) values ($1, $2, $3, $4) returning *",
        [input.name, input.kind, input.brandColor ?? null, input.brandLogoUrl ?? null],
      );
      return clone(mapTenant(result.rows[0]!));
    },

    async getTenant(tenantId) {
      const result = await pool.query("select * from tenants where id = $1", [tenantId]);
      return result.rows[0] ? clone(mapTenant(result.rows[0])) : null;
    },

    async createClient(input) {
      const tenant = await pool.query("select 1 from tenants where id = $1", [input.tenantId]);
      if (tenant.rowCount === 0) throw new Error(`tenant bulunamadı: ${input.tenantId}`);
      const result = await pool.query(
        "insert into clients (tenant_id, name) values ($1, $2) returning *",
        [input.tenantId, input.name],
      );
      return clone(mapClient(result.rows[0]!));
    },

    async listClients(tenantId) {
      const result = await pool.query(
        "select * from clients where tenant_id = $1 order by created_at, id",
        [tenantId],
      );
      return clone(result.rows.map(mapClient));
    },

    async deleteClient(clientId) {
      // FK cascade: sites/scans/receipts/dsars on delete cascade
      const result = await pool.query("delete from clients where id = $1", [clientId]);
      if (result.rowCount === 0) throw new Error(`client bulunamadı: ${clientId}`);
    },

    async createSite(input) {
      await requireClient(input.clientId);
      // token'ı DB de üretebilir; sözleşme birlği için uygulamada üretiyoruz
      const token = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const result = await pool.query(
        "insert into sites (client_id, url, ingest_token) values ($1, $2, $3) returning *",
        [input.clientId, input.url, token],
      );
      return clone(mapSite(result.rows[0]!));
    },

    async getSite(siteId) {
      const result = await pool.query("select * from sites where id = $1", [siteId]);
      return result.rows[0] ? clone(mapSite(result.rows[0])) : null;
    },

    async getSiteByToken(token) {
      const result = await pool.query("select * from sites where ingest_token = $1", [token]);
      return result.rows[0] ? clone(mapSite(result.rows[0])) : null;
    },

    async setBannerConfig(siteId, config) {
      const site = await pool.query("select 1 from sites where id = $1", [siteId]);
      if (site.rowCount === 0) throw new Error(`site bulunamadı: ${siteId}`);
      const result = await pool.query(
        "update sites set banner_config = $2 where id = $1 returning *",
        [siteId, config ? JSON.stringify(config) : null],
      );
      return clone(mapSite(result.rows[0]!));
    },

    async listSites(clientId) {
      const result = await pool.query(
        "select * from sites where client_id = $1 order by created_at, id",
        [clientId],
      );
      return clone(result.rows.map(mapSite));
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

    async listScans(siteId) {
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

    async verifySiteChain(siteId) {
      const result = await pool.query(
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

    async findUserByEmail(email) {
      const result = await pool.query("select * from users where email = $1", [email]);
      return result.rows[0] ? clone(mapUser(result.rows[0])) : null;
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

    async listDsars(siteId) {
      const result = await pool.query(
        "select * from dsar_requests where site_id = $1 order by received_at, id",
        [siteId],
      );
      return clone(result.rows.map(mapDsar));
    },

    async updateDsar(dsarId, patch) {
      const current = await pool.query("select * from dsar_requests where id = $1", [dsarId]);
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

      const updated = await pool.query(
        "update dsar_requests set deadline_at = $2, extended = $3, status = $4, responded_at = $5, response_note = $6 where id = $1 returning *",
        [dsarId, deadlineAt, extended, status, respondedAt, responseNote],
      );
      return clone(mapDsar(updated.rows[0]!));
    },

    async listReceipts(siteId) {
      const result = await pool.query(
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
    },

    async saveCorrection(siteId, input) {
      const site = await pool.query("select 1 from sites where id = $1", [siteId]);
      if (site.rowCount === 0) throw new Error(`site bulunamadı: ${siteId}`);
      await pool.query(
        "insert into corrections (site_id, field_name, category) values ($1, $2, $3) on conflict (site_id, field_name) do update set category = excluded.category",
        [siteId, input.fieldName, input.category],
      );
      return { fieldName: input.fieldName, category: input.category as Correction["category"] };
    },

    async listCorrections(siteId) {
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
      await pool.query(
        "insert into audit_log (tenant_id, action, detail) values ($1, $2, $3)",
        [tenantId, action, JSON.stringify(detail ?? {})],
      );
    },

    async listAudit(tenantId) {
      const result = await pool.query(
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
    },

    async close() {
      await pool.end();
    },
  };
}
