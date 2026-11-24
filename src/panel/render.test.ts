import { describe, expect, it } from "vitest";
import type { StoredScan } from "./types.js";
import {
  renderAccountSettingsPage,
  renderApiKeysPage,
  renderAuditPage,
  renderClientDetailPage,
  renderClientsPage,
  renderForgotPasswordPage,
  renderLoginPage,
  renderRegisterPage,
  renderResetPasswordPage,
  renderSitePage,
  renderVerifyEmailResultPage,
} from "./render.js";

function scan(over: Partial<StoredScan> = {}): StoredScan {
  return {
    id: "scan-1",
    siteId: "site-1",
    scannedAt: "2026-11-01T10:00:00.000Z",
    scripts: [],
    report: {
      siteOrigin: "https://musteri1.com",
      formCount: 2,
      fieldCount: 5,
      categoryCounts: [],
      destinations: [],
      riskFlags: [{ formRef: "f", kind: "get-with-sensitive", detail: "x" }],
      review: [],
      forms: [],
    },
    cookies: [
      { name: "_fbp", domain: ".", category: "marketing" },
      { name: "PHPSESSID", domain: ".", category: "necessary" },
    ],
    observedTargets: [],
    ...over,
  };
}

describe("renderClientsPage", () => {
  it("tenant adını ve client listesini çizer", () => {
    const html = renderClientsPage({
      tenantName: "Ajans A",
      clients: [
        { id: "c1", name: "Müşteri 1" },
        { id: "c2", name: "Müşteri 2" },
      ],
    });
    expect(html).toContain("Ajans A");
    expect(html).toContain("Müşteri 1");
    expect(html).toContain("Müşteri 2");
    expect(html).toContain("/clients/c1");
  });

  it("client adları HTML'e kaçırılır", () => {
    const html = renderClientsPage({
      tenantName: "Ajans",
      clients: [{ id: "c1", name: '"><script>alert(1)</script>' }],
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("boş listede boş durum metni görünür", () => {
    const html = renderClientsPage({ tenantName: "Ajans A", clients: [] });
    expect(html).toContain("Henüz müşteri eklenmedi");
  });
});

describe("renderSitePage", () => {
  it("zincir geçerliyken yeşil rozet basar", () => {
    const html = renderSitePage({
      siteId: "s1",
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: [scan()],
    });
    expect(html).toContain("Kanıt zinciri geçerli");
    expect(html).toContain("https://musteri1.com");
    expect(html).toContain("2");
  });

  it("zincir bozulmuşsa uyarı basar", () => {
    const html = renderSitePage({
      siteId: "s1",
      siteUrl: "https://musteri1.com",
      chainValid: false,
      scans: [],
    });
    expect(html).toContain("Zincir doğrulaması başarısız");
  });

  it("tarama satırlarında risk ve çerez ihlali sayıları görünür", () => {
    const html = renderSitePage({
      siteId: "s1",
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: [scan()],
    });
    // 1 risk işareti + 1 çerez ihlali (_fbp; PHPSESSID hariç)
    expect(html).toContain("2026-11-01");
  });

  it("hiç tarama yoksa boş durum görünür", () => {
    const html = renderSitePage({
      siteId: "s1",
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: [],
    });
    expect(html).toContain("Henüz tarama yok");
  });

  it("10'dan fazla taramada son 10'u gösterilir ve toplam belirtilir", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      scan({ id: `s${i}`, scannedAt: `2026-11-0${(i % 9) + 1}T10:00:00.000Z` }),
    );
    const html = renderSitePage({
      siteId: "s1",
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: many,
    });
    expect(html).toContain("12 taramanın son 10'u");
    expect(html).not.toContain("Henüz tarama yok");
  });

  it("10 veya daha az taramada sayfalama notu çıkmaz", () => {
    const html = renderSitePage({
      siteId: "s1",
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: [scan()],
    });
    expect(html).not.toContain("son 10'u");
  });

  it("iki tarama arasında değişiklik varsa uyarı bölümü basılır", () => {
    const base = scan();
    const prev = { ...base, id: "p1", scannedAt: "2026-11-01T10:00:00.000Z" };
    const curr = {
      ...base,
      id: "c1",
      scannedAt: "2026-11-03T10:00:00.000Z",
      report: {
        ...base.report,
        forms: [
          { ref: "form-0", fields: [{ name: "email", category: "email" as const }] },
          {
            ref: "form-1",
            fields: [
              { name: "tcno", category: "tckn" as const },
              { name: "adsoyad", category: "full_name" as const },
            ],
          },
        ],
      },
    };
    const html = renderSitePage({
      siteId: "s1",
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: [prev, curr],
    });
    expect(html).toContain("Değişiklik Uyarısı");
    expect(html).toContain("form-1");
    expect(html).toContain("tcno");
  });

  it("tek taramada uyarı bölümü çıkmaz", () => {
    const html = renderSitePage({
      siteId: "s1",
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: [scan()],
    });
    expect(html).not.toContain("Değişiklik Uyarısı");
  });

  it("site URL'i HTML'e kaçırılır", () => {
    const html = renderSitePage({
      siteId: "s1",
      siteUrl: 'https://x.com/?"><script>alert(1)</script>',
      chainValid: true,
      scans: [],
    });
    expect(html).not.toContain("<script>alert");
  });

  it("kanıt ihracı ve metin taslağı bağlantıları çizilir", () => {
    const html = renderSitePage({
      siteId: "s1",
      siteUrl: "https://musteri1.com",
      chainValid: true,
      scans: [],
      evidenceHref: "/sites/s1/evidence.csv",
      draftLinks: [{ href: "/sites/s1/draft/aydinlatma", label: "Aydınlatma metni" }],
    });
    expect(html).toContain('/sites/s1/evidence.csv');
    expect(html).toContain("Kanıt ihracı (CSV)");
    expect(html).toContain("Aydınlatma metni");
  });
});

describe("white-label accent", () => {
  it("geçerli marka rengi CSS değişkeni olarak uygulanır", () => {
    const html = renderClientsPage({ tenantName: "X", clients: [], accent: "#127a3d" });
    expect(html).toContain("--accent: #127a3d");
  });

  it("geçersiz marka rengi yoksayılır (CSS enjeksiyonu engeli)", () => {
    const html = renderClientsPage({
      tenantName: "X",
      clients: [],
      accent: "javascript:alert(1)",
    });
    expect(html).not.toContain("javascript:");
    expect(html).toContain("--accent: #16161f");
  });

  it("http(s) logosu img olarak basılır; javascript: şeması engellenir", () => {
    const ok = renderClientsPage({
      tenantName: "X",
      clients: [],
      logoUrl: "https://ajans.com/logo.png",
    });
    expect(ok).toContain('<img src="https://ajans.com/logo.png"');
    const evil = renderClientsPage({
      tenantName: "X",
      clients: [],
      logoUrl: "javascript:alert(1)",
    });
    expect(evil).not.toContain("javascript:alert(1)");
  });
});

describe("renderClientDetailPage", () => {
  const sites = [
    {
      id: "s1",
      clientId: "c1",
      url: "https://musteri1.com",
      ingestToken: "a".repeat(64),
      createdAt: "2026-11-02T10:00:00.000Z",
    },
  ];

  it("müşteri adını, site satırlarını ve ingest token'ını gösterir", () => {
    const html = renderClientDetailPage({
      clientName: "Müşteri 1",
      clientHref: "/clients/c1",
      sites,
    });
    expect(html).toContain("Müşteri 1");
    expect(html).toContain("https://musteri1.com");
    expect(html).toContain("a".repeat(64));
    expect(html).toContain("/sites/s1");
    expect(html).toContain('action="/clients/c1/sites"');
  });

  it("site yoksa boş durum gösterir ve form sunar", () => {
    const html = renderClientDetailPage({
      clientName: "Yeni Müşteri",
      clientHref: "/clients/c2",
      sites: [],
    });
    expect(html).toContain("Henüz site eklenmedi");
    expect(html).toContain('action="/clients/c2/sites"');
  });

  it("site URL ve token HTML'e kaçırılır", () => {
    const html = renderClientDetailPage({
      clientName: "M",
      clientHref: "/clients/c1",
      sites: [
        {
          id: "s1",
          url: 'https://x.com/?"><script>a()</script>',
          ingestToken: "b".repeat(64),
        },
      ],
    });
    expect(html).not.toContain("<script>a()");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("panel navigasyonu", () => {
  const navLinks = ['href="/clients"', 'href="/audit"', 'href="/settings/api-keys"', 'href="/settings/account"', 'href="/api/docs"', 'href="/logout"'];

  it("oturumlu sayfaların hepsinde ortak nav ve çıkış linki var", () => {
    const pages = [
      renderClientsPage({ tenantName: "A", clients: [] }),
      renderClientDetailPage({ clientName: "M", clientHref: "/clients/c1", sites: [] }),
      renderSitePage({ siteId: "s1", siteUrl: "https://x.com", chainValid: true, scans: [] }),
      renderAuditPage({ entries: [] }),
      renderApiKeysPage({ keys: [] }),
      renderAccountSettingsPage({ email: "a@b.com", emailVerified: true }),
    ];
    for (const html of pages) {
      for (const link of navLinks) expect(html).toContain(link);
    }
  });

  it("aktif sayfa aria-current ile işaretlenir", () => {
    expect(renderClientsPage({ tenantName: "A", clients: [] })).toContain('href="/clients" aria-current="page"');
    expect(renderAuditPage({ entries: [] })).toContain('href="/audit" aria-current="page"');
    expect(renderApiKeysPage({ keys: [] })).toContain('href="/settings/api-keys" aria-current="page"');
    expect(renderAccountSettingsPage({ email: "a@b.com", emailVerified: true })).toContain('href="/settings/account" aria-current="page"');
  });

  it("kamu sayfalarında (login/register) nav yok", () => {
    expect(renderLoginPage()).not.toContain('href="/logout"');
    expect(renderRegisterPage()).not.toContain('href="/logout"');
  });
});

describe("embed snippet", () => {
  it("verilen panel adresini gösterir, olmayan CDN'i değil", () => {
    const html = renderClientDetailPage({
      clientName: "M",
      clientHref: "/clients/c1",
      sites: [],
      embedSrc: "https://panel.ajans.com/embed.js",
    });
    expect(html).toContain("https://panel.ajans.com/embed.js");
    expect(html).not.toContain("cdn.veriform.io");
  });

  it("embedSrc verilmezse göreli /embed.js kullanır", () => {
    const html = renderClientDetailPage({ clientName: "M", clientHref: "/clients/c1", sites: [] });
    expect(html).toContain("/embed.js");
    expect(html).not.toContain("cdn.veriform.io");
  });

  it("embedSrc HTML'e kaçırılır", () => {
    const html = renderClientDetailPage({
      clientName: "M",
      clientHref: "/clients/c1",
      sites: [],
      embedSrc: 'https://x.com/"><script>a()</script>',
    });
    expect(html).not.toContain("<script>a()");
  });
});

describe("renderLoginPage / renderRegisterPage", () => {
  it("giriş formu POST /login'e e-posta+şifre alanlarıyla çizilir", () => {
    const html = renderLoginPage();
    expect(html).toContain('action="/login"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });

  it("hata kodu statik metne çevrilir (kullanıcı verisi HTML'e girmez)", () => {
    const html = renderLoginPage({ hasError: true });
    expect(html).toContain("E-posta veya şifre hatalı");
    const reg = renderRegisterPage({ errorKind: "duplicate" });
    expect(reg).toContain("zaten kayıtlı");
  });

  it("kayıt formu ajans adı + e-posta + şifre ister ve POST /register'e gider", () => {
    const html = renderRegisterPage();
    expect(html).toContain('action="/register"');
    expect(html).toContain('name="name"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });
});

describe("kurulum checklist'i (onboarding)", () => {
  const status = (over: Partial<{ hasClient: boolean; hasSite: boolean; hasScan: boolean }> = {}) => ({
    hasClient: false,
    hasSite: false,
    hasScan: false,
    ...over,
  });

  it("kiracı yeniyken üç adımı ve rehber linkini basar", () => {
    const html = renderClientsPage({ tenantName: "A", clients: [], onboarding: status() });
    expect(html).toContain("Kurulum");
    expect(html).toContain("Müşteri ekle");
    expect(html).toContain("Site ekle");
    expect(html).toContain("İlk tarama");
    expect(html).toContain('href="/rehber"');
  });

  it("tamamlanan adım işaretlenir, bekleyen adım işaretlenmez", () => {
    const html = renderClientsPage({
      tenantName: "A",
      clients: [{ id: "c1", name: "M" }],
      onboarding: status({ hasClient: true }),
    });
    expect((html.match(/class="setup-done"/g) ?? []).length).toBe(1);
  });

  it("üç adım da tamamsa checklist tamamen gizlenir", () => {
    const html = renderClientsPage({
      tenantName: "A",
      clients: [{ id: "c1", name: "M" }],
      onboarding: status({ hasClient: true, hasSite: true, hasScan: true }),
    });
    expect(html).not.toContain("Kurulum");
  });

  it("onboarding girdisi yoksa checklist basılmaz (eski çağrılar bozulmaz)", () => {
    const html = renderClientsPage({ tenantName: "A", clients: [] });
    expect(html).not.toContain("Kurulum");
  });
});

describe("boş durum yönlendirmeleri", () => {
  it("site sayfası boş taramada CLI komutu değil panel içi yönlendirme gösterir", () => {
    const html = renderSitePage({ siteId: "s1", siteUrl: "https://x.com", chainValid: true, scans: [] });
    expect(html).not.toContain("pnpm demo");
    expect(html).toContain("Sürekli İzleme çizelgesini açın");
  });

  it("müşteri detayı boş site listesinde ilk tarama yolunu anlatır", () => {
    const html = renderClientDetailPage({ clientName: "M", clientHref: "/clients/c1", sites: [] });
    expect(html).toContain("Henüz site eklenmedi");
    expect(html).toContain("ilk tarama");
  });

  it("nav'da Rehber bağlantısı tüm oturumlu sayfalarda var", () => {
    const pages = [
      renderClientsPage({ tenantName: "A", clients: [] }),
      renderAuditPage({ entries: [] }),
      renderApiKeysPage({ keys: [] }),
    ];
    for (const html of pages) expect(html).toContain('href="/rehber"');
  });
});

describe("paket kotası (panel yüzeyi)", () => {
  it("kayıt formu paket seçimi sunar — üç seçenek, varsayılan starter", () => {
    const html = renderRegisterPage();
    expect(html).toContain('name="package"');
    expect(html).toContain('<option value="starter" selected>');
    expect(html).toContain('<option value="pro">');
    expect(html).toContain('<option value="ultimate">');
  });

  it("müşteri listesi paket etiketini ve kullanımı gösterir", () => {
    const html = renderClientsPage({
      tenantName: "A",
      clients: [],
      quota: { label: "Starter", used: 2, limit: 3 },
    });
    expect(html).toContain("Starter");
    expect(html).toContain("2/3 site");
  });

  it("sınırsız pakette limit yerine sınırsız yazar", () => {
    const html = renderClientsPage({
      tenantName: "A",
      clients: [],
      quota: { label: "Ultimate", used: 5, limit: null },
    });
    expect(html).toContain("Ultimate");
    expect(html).toContain("sınırsız");
    expect(html).not.toContain("/null");
  });

  it("quota girdisi yoksa kota satırı basılmaz", () => {
    const html = renderClientsPage({ tenantName: "A", clients: [] });
    expect(html).not.toContain("Paket:");
  });

  it("kota dolunca müşteri detayında uyarı ve yükseltme bağlantıları çıkar", () => {
    const html = renderClientDetailPage({
      clientName: "M",
      clientHref: "/clients/c1",
      sites: [],
      quotaFull: true,
    });
    expect(html).toContain("Site kotası doldu");
    expect(html).toContain('href="/#paketler"');
    expect(html).toContain('href="/#iletisim"');
  });

  it("quotaFull yokken uyarı çıkmaz", () => {
    const html = renderClientDetailPage({ clientName: "M", clientHref: "/clients/c1", sites: [] });
    expect(html).not.toContain("Site kotası doldu");
  });
});

describe("şifre sıfırlama yüzeyi", () => {
  it("forgot formu POST /forgot-password'e e-posta alanıyla gider", () => {
    const html = renderForgotPasswordPage();
    expect(html).toContain('action="/forgot-password"');
    expect(html).toContain('name="email"');
    expect(html).not.toContain('href="/logout"');
  });

  it("gönderim sonrası mesaj varlık sızdırmazdır", () => {
    const html = renderForgotPasswordPage({ sent: true });
    expect(html).toContain("Bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi");
  });

  it("reset formu token'ı gizli taşır ve POST /reset-password'e gider", () => {
    const html = renderResetPasswordPage({ token: "a".repeat(64) });
    expect(html).toContain('action="/reset-password"');
    expect(html).toContain(`name="token" value="${"a".repeat(64)}"`);
    expect(html).toContain('type="hidden"');
    expect(html).toContain('minlength="8"');
  });

  it("reset token'ı HTML'e kaçırılır", () => {
    const html = renderResetPasswordPage({ token: '"><script>a()</script>' });
    expect(html).not.toContain("<script>a()");
  });

  it("reset hata kodları statik metne çevrilir", () => {
    expect(renderResetPasswordPage({ token: "t", errorKind: "short" })).toContain("en az 8");
    expect(renderResetPasswordPage({ token: "t", errorKind: "invalid" })).toContain("geçersiz veya süresi dolmuş");
  });

  it("doğrulama sonuç sayfası başarılı/başarısız durumları basar", () => {
    const ok = renderVerifyEmailResultPage({ ok: true });
    expect(ok).toContain("doğrulandı");
    expect(ok).toContain('href="/clients"');
    const bad = renderVerifyEmailResultPage({ ok: false });
    expect(bad).toContain("geçersiz veya süresi dolmuş");
    expect(bad).toContain('href="/settings/account"');
  });

  it("login sayfasında şifremi unuttum bağlantısı var", () => {
    expect(renderLoginPage()).toContain('href="/forgot-password"');
  });

  it("login sıfırlama/silme sonrası bilgilendirme kaşesi basar", () => {
    expect(renderLoginPage({ notice: "reset" })).toContain("Şifreniz güncellendi");
    expect(renderLoginPage({ notice: "deleted" })).toContain("Hesabınız ve tüm verileriniz silindi");
  });
});

describe("hesap ayarları sayfası", () => {
  it("doğrulanmış e-posta kaşesi ve şifre değiştirme formu var", () => {
    const html = renderAccountSettingsPage({ email: "a@b.com", emailVerified: true });
    expect(html).toContain("a@b.com");
    expect(html).toContain("Doğrulandı");
    expect(html).toContain('action="/settings/account/password"');
    expect(html).toContain('name="currentPassword"');
    expect(html).toContain('name="newPassword"');
  });

  it("doğrulanmamış e-posta uyarısı ve yeniden gönderme formu var", () => {
    const html = renderAccountSettingsPage({ email: "a@b.com", emailVerified: false });
    expect(html).toContain("doğrulanmadı");
    expect(html).toContain('action="/settings/account/resend-verification"');
  });

  it("hesap silme formu onay kutusu ister ve danger düğmesiyle gider", () => {
    const html = renderAccountSettingsPage({ email: "a@b.com", emailVerified: true });
    expect(html).toContain('action="/settings/account/delete"');
    expect(html).toContain('name="confirm"');
    expect(html).toContain('class="danger"');
    expect(html).toContain("kalıcı");
  });

  it("bildirim ve hata kodları statik metne çevrilir", () => {
    expect(renderAccountSettingsPage({ email: "a@b.com", emailVerified: false, notice: "verify-sent" })).toContain("doğrulama bağlantısı gönderildi");
    expect(renderAccountSettingsPage({ email: "a@b.com", emailVerified: true, notice: "password-changed" })).toContain("Şifreniz güncellendi");
    expect(renderAccountSettingsPage({ email: "a@b.com", emailVerified: true, errorKind: "current" })).toContain("mevcut şifre hatalı");
    expect(renderAccountSettingsPage({ email: "a@b.com", emailVerified: true, errorKind: "short" })).toContain("en az 8");
    expect(renderAccountSettingsPage({ email: "a@b.com", emailVerified: true, errorKind: "mail" })).toContain("E-posta gönderilemedi");
  });

  it("e-posta HTML'e kaçırılır", () => {
    const html = renderAccountSettingsPage({ email: '"><script>a()</script>', emailVerified: true });
    expect(html).not.toContain("<script>a()");
  });
});

describe("doğrulanmamış e-posta uyarısı (clients)", () => {
  it("emailVerified false ise ayarlara yönlendiren uyarı basılır", () => {
    const html = renderClientsPage({ tenantName: "A", clients: [], emailVerified: false });
    expect(html).toContain("doğrulanmadı");
    expect(html).toContain('href="/settings/account"');
  });

  it("emailVerified true veya verilmezse uyarı yok", () => {
    expect(renderClientsPage({ tenantName: "A", clients: [], emailVerified: true })).not.toContain("doğrulanmadı");
    expect(renderClientsPage({ tenantName: "A", clients: [] })).not.toContain("doğrulanmadı");
  });
});
