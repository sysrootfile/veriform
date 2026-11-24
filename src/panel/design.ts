/**
 * Zincir Defter dünya kaynağı — DESIGN.md tek görsel otoritedir.
 * Landing ve tüm panel/kamu yüzeyler aynı font, token ve bileşen CSS'ini
 * buradan alır; yüzeyler yalnızca kendi düzenini ekler.
 */

export const FONT_FACES = `@font-face{font-family:"Archivo";font-style:normal;font-weight:100 900;font-display:swap;
  src:url("/assets/fonts/archivo-latin-ext.woff2") format("woff2");
  unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"Archivo";font-style:normal;font-weight:100 900;font-display:swap;
  src:url("/assets/fonts/archivo-latin.woff2") format("woff2");
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"Spline Sans Mono";font-style:normal;font-weight:300 700;font-display:swap;
  src:url("/assets/fonts/spline-mono-latin-ext.woff2") format("woff2");
  unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"Spline Sans Mono";font-style:normal;font-weight:300 700;font-display:swap;
  src:url("/assets/fonts/spline-mono-latin.woff2") format("woff2");
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`;

export const WORLD_TOKENS = `:root{
  --paper:#f6f7f4;--desk:#e7e9e2;--ink:#191d26;--ink-soft:#3f4553;--ink-faint:#6a7080;
  --blue:#2447c9;--red:#c93a2e;--green:#1e7a46;--amber:#b45309;
  --rule:rgba(36,71,201,.30);--rule-soft:rgba(36,71,201,.13);
  --ease:cubic-bezier(.23,1,.32,1);
}`;

export const WORLD_BASE = `*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--desk);color:var(--ink);font-family:"Archivo",system-ui,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
.mono{font-family:"Spline Sans Mono",ui-monospace,monospace}
::selection{background:var(--blue);color:#fff}
:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
input,textarea,select{caret-color:var(--blue)}
*{scrollbar-width:thin;scrollbar-color:var(--blue) var(--paper)}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:var(--paper)}
::-webkit-scrollbar-thumb{background:var(--blue);border:2px solid var(--paper);border-radius:6px}
::-webkit-scrollbar-thumb:hover{background:var(--ink)}
img,svg{display:inline-block;vertical-align:middle}
a{color:var(--blue)}`;

/** Defter yaprağı: kağıt, kırmızı marj, cilt delikleri, antet + folyo. */
export const SHEET_CSS = `.sheet{position:relative;max-width:var(--sheet-w,1080px);margin:28px auto 40px;background:var(--paper);padding:36px clamp(24px,5vw,56px) 44px clamp(56px,8vw,92px);box-shadow:0 2px 6px rgba(25,29,38,.07),0 20px 48px rgba(25,29,38,.11)}
.sheet::before{content:"";position:absolute;top:0;bottom:0;left:clamp(40px,6vw,64px);width:2px;background:var(--red);opacity:.65}
.holes{position:absolute;left:clamp(14px,2.6vw,26px);top:0;bottom:0;display:flex;flex-direction:column;justify-content:space-evenly;pointer-events:none}
.hole{width:16px;height:16px;border-radius:50%;background:var(--desk);box-shadow:inset 0 1px 3px rgba(25,29,38,.4)}
.antet{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:12px;margin-bottom:28px;font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.74rem;font-weight:600;letter-spacing:.16em;color:var(--ink)}
.antet a{color:var(--ink);text-decoration:none}
.antet span:last-child{color:var(--ink-soft);text-transform:uppercase}
@media (hover:hover) and (pointer:fine){.antet a:hover{color:var(--blue)}}
@media (max-width:600px){
  .sheet{margin:16px auto 28px;padding:32px 20px 44px 52px}
  .sheet::before{left:38px}
  .holes{left:12px}
  .hole{width:13px;height:13px}
  .antet{font-size:.62rem;letter-spacing:.1em;margin-bottom:26px}
}`;

/** Çizgili satır tablosu — başlıklar mono antet sesi, sayılar mono kanıt. */
export const TABLE_CSS = `table{width:100%;border-collapse:collapse;margin:.6rem 0 1.2rem}
th{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);border-bottom:2px solid var(--ink);padding:8px 10px;text-align:left}
td{border-bottom:1px solid var(--rule);padding:9px 10px;text-align:left;font-size:.92rem;vertical-align:top}
.num{text-align:right;font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.85rem}
.table-scroll{overflow-x:auto}`;

export const CODE_CSS = `code{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.8rem;background:var(--desk);padding:.1rem .35rem;border-radius:4px;word-break:break-all}
pre{background:#12151d;color:#e8eaf2;padding:14px 18px;border-radius:8px;overflow-x:auto;font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.78rem;line-height:1.7}
pre code{background:none;padding:0;word-break:normal}`;

/** Panel (Operate): sabit rem ölçek, mühür butonlar, alt-çizgili alanlar, kaşe rozetler. */
export const PANEL_CSS = `.topnav{position:sticky;top:0;z-index:50;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;background:var(--paper);border-bottom:2px solid var(--blue);padding:10px clamp(16px,4vw,40px)}
.topnav a{color:var(--ink-soft);text-decoration:none;font-size:.86rem;font-weight:600;padding:6px 2px}
.topnav a[aria-current="page"]{color:var(--blue);text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:2px}
.topnav .nav-logout{margin-left:auto}
@media (hover:hover) and (pointer:fine){
  .topnav a:hover{color:var(--blue)}
  .topnav .nav-logout:hover{color:var(--red)}
}
h1{font-size:1.35rem;font-weight:800;letter-spacing:-.01em;line-height:1.2;margin:0 0 14px;color:var(--ink)}
h2{font-size:1.02rem;font-weight:800;margin:1.9rem 0 .6rem;color:var(--ink)}
p{margin:.6rem 0}
ul,ol{margin:.5rem 0;padding-left:1.3rem}
li{margin:.3rem 0}
.empty{color:var(--ink-soft);font-size:.92rem}
${TABLE_CSS}
${CODE_CSS}
span.badge-ok,span.badge-warn{display:inline-block;font-family:"Spline Sans Mono",ui-monospace,monospace;font-weight:700;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border:2px solid currentColor;border-radius:4px;background:var(--paper);transform:rotate(-4deg)}
span.badge-ok{color:var(--green)}
span.badge-warn{color:var(--amber)}
p.badge-ok,p.badge-warn{border:2px solid var(--green);border-radius:8px;padding:10px 14px;font-size:.92rem;color:var(--ink);background:var(--paper)}
p.badge-warn{border-color:var(--amber)}
form{margin:1rem 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
input:not([type="checkbox"]):not([type="hidden"]),select,textarea{font-family:"Archivo",system-ui,sans-serif;font-size:.95rem;color:var(--ink);background:transparent;border:none;border-bottom:2px solid var(--rule);padding:9px 2px;border-radius:0;transition:border-color 160ms var(--ease)}
input:focus,select:focus,textarea:focus{outline:none;border-bottom-color:var(--blue)}
input::placeholder,textarea::placeholder{color:var(--ink-faint)}
input[type="checkbox"]{accent-color:var(--blue);width:16px;height:16px}
select{cursor:pointer}
label{display:inline-flex;align-items:center;gap:8px;font-size:.9rem}
button{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;font-family:"Archivo",system-ui,sans-serif;font-weight:700;font-size:.82rem;letter-spacing:.05em;text-transform:uppercase;padding:9px 16px;border:none;border-radius:6px;cursor:pointer;box-shadow:0 4px 12px color-mix(in srgb,var(--accent) 25%,transparent);transition:transform 160ms var(--ease),box-shadow 160ms var(--ease)}
button:active{transform:scale(.97)}
button:disabled{opacity:.45;cursor:not-allowed}
button.danger{background:var(--red);box-shadow:0 4px 12px rgba(201,58,46,.25)}
td button{padding:6px 12px;font-size:.7rem}
@media (hover:hover) and (pointer:fine){
  button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 7px 18px color-mix(in srgb,var(--accent) 32%,transparent)}
  button.danger:hover{box-shadow:0 7px 18px rgba(201,58,46,.32)}
}
.setup{border:2px solid var(--ink);border-radius:8px;padding:18px 22px;margin:0 0 1.4rem;background:rgba(36,71,201,.045)}
.setup h2{margin:0 0 .5rem;font-size:1.02rem}
.setup ol{margin:.3rem 0 .5rem;padding-left:1.2rem}
.setup li{margin:.35rem 0;font-size:.92rem}
.setup li.setup-done{color:var(--green)}
.setup li.setup-current{border-left:3px solid var(--blue);padding-left:10px;margin-left:-13px}
.setup-cta{font-weight:700;white-space:nowrap}
.setup-complete{margin:0 0 1.2rem}
.setup-hint{color:var(--ink-soft);font-size:.85rem}
.advanced{margin:1.4rem 0;border:1px solid var(--rule);border-radius:8px;padding:10px 14px;background:var(--paper)}
.advanced summary{cursor:pointer;font-weight:700;font-size:.9rem;color:var(--ink-soft)}
.advanced[open] summary{margin-bottom:.6rem;color:var(--ink)}
.plan-list{list-style:none;padding:0;margin:.6rem 0;display:flex;flex-direction:column}
.plan-list li{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--rule);margin:0}
.plan-list form{display:inline;margin:0}
footer{color:var(--ink-soft);font-size:.72rem;font-family:"Spline Sans Mono",ui-monospace,monospace;letter-spacing:.04em;border-top:2px solid var(--ink);margin-top:2.2rem;padding-top:14px}
@media (prefers-reduced-motion:reduce){
  button,input,select,textarea{transition:none}
  button:hover{transform:none}
}`;

/** Rapor bileşenleri — /tarama gömülü çıktıda kapsam dışı (scopesuz) kullanılır. */
export const REPORT_COMPONENTS = `.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:2px solid var(--ink);margin:1rem 0 1.4rem}
.card{padding:14px 16px;border-left:1px solid var(--rule);font-size:.85rem;color:var(--ink-soft)}
.card:first-child{border-left:none}
.card b{display:block;font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:1.6rem;font-weight:700;color:var(--ink);letter-spacing:-.02em}
.meta{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.72rem;color:var(--ink-soft);letter-spacing:.02em}
span.ok,span.warn{display:inline-block;font-family:"Spline Sans Mono",ui-monospace,monospace;font-weight:700;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border:2px solid currentColor;border-radius:4px;background:var(--paper);transform:rotate(-4deg)}
span.ok{color:var(--green)}
span.warn{color:var(--amber)}
p.warn{border:2px solid var(--amber);border-radius:8px;padding:10px 14px;font-size:.92rem;color:var(--ink);background:var(--paper)}
@media (max-width:600px){
  .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
  .card{border-top:1px solid var(--rule)}
  .card:nth-child(-n+2){border-top:none}
  .card:nth-child(3){border-left:none}
}`;

/** Yasal sayfalar (Read): 70ch ölçü, mono yürürlük satırı, kağıt üst şerit. */
export const LEGAL_CSS = `h1{font-size:1.5rem;font-weight:800;letter-spacing:-.01em;line-height:1.2;margin:0 0 14px}
h2{font-size:1.05rem;font-weight:800;margin:1.9rem 0 .6rem}
p{margin:.7rem 0;max-width:70ch}
ul,ol{margin:.5rem 0;padding-left:1.3rem;max-width:70ch}
li{margin:.35rem 0}
.muted{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.72rem;color:var(--ink-soft);letter-spacing:.02em}
.legal-nav{position:sticky;top:0;z-index:50;background:var(--paper);border-bottom:2px solid var(--blue);padding:10px clamp(16px,4vw,40px);font-size:.86rem;font-weight:600}
.legal-nav a{color:var(--ink-soft);text-decoration:none}
@media (hover:hover) and (pointer:fine){.legal-nav a:hover{color:var(--blue)}}
.legal-footer{margin-top:2.5rem;border-top:2px solid var(--ink);padding-top:1rem;font-size:.72rem;font-family:"Spline Sans Mono",ui-monospace,monospace;color:var(--ink-soft);display:flex;gap:1.2rem;flex-wrap:wrap}
.legal-footer a{color:var(--ink-soft);text-decoration:underline;text-underline-offset:3px}
@media (hover:hover) and (pointer:fine){.legal-footer a:hover{color:var(--blue)}}
${TABLE_CSS}`;

/** Bağımsız rapor belgesi — tüm seçiciler .vf-report kapsamında (gömülmede sızmaz). */
export const REPORT_DOC_CSS = `body.vf-report{background:var(--paper);max-width:860px;margin:0 auto;padding:40px clamp(20px,5vw,48px) 48px}
.vf-report h1{font-size:1.35rem;font-weight:800;letter-spacing:-.01em;line-height:1.2;margin:0 0 10px}
.vf-report h2{font-size:1.02rem;font-weight:800;margin:1.9rem 0 .6rem}
.vf-report p{margin:.6rem 0}
.vf-report ul{margin:.5rem 0;padding-left:1.3rem}
.vf-report li{margin:.35rem 0}
.vf-report .meta{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.72rem;color:var(--ink-soft);letter-spacing:.02em}
.vf-report .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:2px solid var(--ink);margin:1rem 0 1.4rem}
.vf-report .card{padding:14px 16px;border-left:1px solid var(--rule);font-size:.85rem;color:var(--ink-soft)}
.vf-report .card:first-child{border-left:none}
.vf-report .card b{display:block;font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:1.6rem;font-weight:700;color:var(--ink);letter-spacing:-.02em}
.vf-report table{width:100%;border-collapse:collapse;margin:.6rem 0 1.2rem}
.vf-report th{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);border-bottom:2px solid var(--ink);padding:8px 10px;text-align:left}
.vf-report td{border-bottom:1px solid var(--rule);padding:9px 10px;text-align:left;font-size:.92rem;vertical-align:top}
.vf-report .num{text-align:right;font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.85rem}
.vf-report span.ok,.vf-report span.warn{display:inline-block;font-family:"Spline Sans Mono",ui-monospace,monospace;font-weight:700;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border:2px solid currentColor;border-radius:4px;background:var(--paper);transform:rotate(-4deg)}
.vf-report span.ok{color:var(--green)}
.vf-report span.warn{color:var(--amber)}
.vf-report code{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:.8rem;background:var(--desk);padding:.1rem .35rem;border-radius:4px;word-break:break-all}
.vf-report footer{color:var(--ink-soft);font-size:.72rem;font-family:"Spline Sans Mono",ui-monospace,monospace;letter-spacing:.04em;border-top:2px solid var(--ink);margin-top:2.2rem;padding-top:14px}
@media (max-width:600px){
  .vf-report .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
  .vf-report .card{border-top:1px solid var(--rule)}
  .vf-report .card:nth-child(-n+2){border-top:none}
  .vf-report .card:nth-child(3){border-left:none}
}`;

/** Antet + folyo + cilt delikleri — her kağıdın açılışı (Folio Rule). */
export function sheetOpen(folio: string): string {
  return `<div class="sheet">
<div class="holes" aria-hidden="true"><span class="hole"></span><span class="hole"></span><span class="hole"></span></div>
<div class="antet"><a href="/">VERİFORM — UYUM DEFTERİ</a><span>SAYFA · ${folio}</span></div>`;
}