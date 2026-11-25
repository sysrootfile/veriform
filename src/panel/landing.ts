/**
 * Kamu landing sayfası — "Zincir Defter" dünyası.
 * Saf render fonksiyonu: tüm metin statik, kullanıcı girdisi yok (contactStatus enum).
 * Canlı demo zinciri tarayıcıda gerçek sha256 ile koşar (crypto.subtle);
 * seed satırların hash'leri sunucuda önceden hesaplanmıştır — JS'siz de görünür.
 */

import { createHash } from "node:crypto";
import { FONT_FACES } from "./design.js";

export interface LandingOptions {
  contactStatus?: "ok" | "invalid" | undefined;
}

interface ChainRow {
  date: string;
  site: string;
  forms: number;
  cookies: number;
  consents: number;
  content: string;
  hash: string;
}

function rowContent(date: string, site: string, forms: number, cookies: number, consents: number): string {
  return `${date}|${site}|form:${forms}|cookie:${cookies}|onay:${consents}`;
}

const SEED_ROWS: ChainRow[] = [
  {
    date: "2026-11-12 09:14",
    site: "ornek-musteri.com",
    forms: 3,
    cookies: 2,
    consents: 1,
    content: rowContent("2026-11-12T09:14Z", "ornek-musteri.com", 3, 2, 1),
    hash: "da1099487b2cc04e5db2adee39943a4af0fa5496d2b222503f54f41b0fea87bd",
  },
  {
    date: "2026-11-15 14:02",
    site: "ornek-musteri.com",
    forms: 3,
    cookies: 3,
    consents: 1,
    content: rowContent("2026-11-15T14:02Z", "ornek-musteri.com", 3, 3, 1),
    hash: "73eaec13f4cfe4a95ace5957fabc53ff077e4a1b8efce68b2fddc5e286d0eac3",
  },
];

const SAMPLE_POOL = [
  { date: "2026-11-18 08:31", site: "demo-magaza.com", forms: 4, cookies: 2, consents: 1 },
  { date: "2026-11-18 11:47", site: "ajans-musteri.com", forms: 2, cookies: 4, consents: 2 },
  { date: "2026-11-19 16:05", site: "ornek-musteri.com", forms: 5, cookies: 3, consents: 1 },
  { date: "2026-11-20 10:22", site: "demo-magaza.com", forms: 4, cookies: 3, consents: 2 },
  { date: "2026-11-21 13:58", site: "ajans-musteri.com", forms: 2, cookies: 4, consents: 2 },
];

const ICONS = {
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  stamp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 22h14"/><path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11a2.5 2.5 0 0 0-2.5 2.5V16a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-.5a2.5 2.5 0 0 0-.73-1.77Z"/><path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"/></svg>',
} as const;

function icon(name: keyof typeof ICONS, size = 16): string {
  return ICONS[name].replace("<svg ", `<svg width="${size}" height="${size}" `);
}

function summaryText(r: { forms: number; cookies: number; consents: number }): string {
  return `${r.forms} form · ${r.cookies} çerez kategorisi · ${r.consents} onay`;
}

function renderSeedRow(r: ChainRow, index: number): string {
  return `<li class="chain-row" data-index="${index}">
  <div class="row-main">
    <span class="row-meta">${r.date} · ${r.site}</span>
    <span class="row-summary">${summaryText(r)}</span>
  </div>
  <span class="row-hash" title="${r.hash}">${icon("link", 13)}<span class="hash-text">${r.hash.slice(0, 12)}…</span></span>
  <span class="row-stamp-slot"></span>
</li>`;
}

const CONTACT_STAMPS: Record<"ok" | "invalid", { cls: string; title: string; body: string }> = {
  ok: {
    cls: "ok",
    title: "Talebiniz alındı",
    body: "Talep deftere işlendi ve operatöre iletilir. Kayıtlı e-posta adresinden dönüş yapılır.",
  },
  invalid: {
    cls: "warn",
    title: "Formu kontrol edin",
    body: "Ad en az 2 karakter, mesaj en az 10 karakter olmalı; e-posta geçerli bir adres olmalı. Düzeltip yeniden mühürleyin.",
  },
};

const CSS = `
:root{
  --paper:#f6f7f4;--desk:#e7e9e2;--ink:#191d26;--ink-soft:#3f4553;
  --blue:#2447c9;--red:#c93a2e;--green:#1e7a46;--amber:#b45309;
  --rule:rgba(36,71,201,.30);--rule-soft:rgba(36,71,201,.13);
  --ease:cubic-bezier(.23,1,.32,1);--nav-h:64px;
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;background:var(--desk);color:var(--ink);
  font-family:"Archivo",system-ui,sans-serif;font-size:16px;line-height:1.6;
  -webkit-font-smoothing:antialiased;
}
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
a{color:var(--blue)}

${FONT_FACES}

/* ---- üst şerit (sabit) ---- */
.nav{
  position:fixed;inset:0 0 auto 0;height:var(--nav-h);z-index:50;
  display:flex;align-items:center;gap:20px;padding:0 clamp(16px,4vw,40px);
  background:var(--paper);border-bottom:2px solid var(--blue);
}
.brand{font-family:"Spline Sans Mono",monospace;font-weight:700;font-size:.95rem;letter-spacing:.14em;color:var(--ink);text-decoration:none;white-space:nowrap}
.brand em{font-style:normal;color:var(--red)}
.nav-links{display:flex;gap:clamp(10px,2vw,22px);align-items:center;margin-left:auto;overflow-x:auto;scrollbar-width:none}
.nav-links::-webkit-scrollbar{display:none}
.nav-links a{color:var(--ink-soft);text-decoration:none;font-size:.86rem;font-weight:600;white-space:nowrap;padding:6px 2px}
.nav-links a[aria-current="true"]{color:var(--blue);text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:2px}
.nav-cta{display:inline-flex;align-items:center;gap:8px;background:var(--green);color:#fff;text-decoration:none;font-weight:700;font-size:.82rem;letter-spacing:.05em;text-transform:uppercase;padding:9px 16px;border-radius:6px;white-space:nowrap;transition:transform 160ms var(--ease),box-shadow 160ms var(--ease);box-shadow:0 4px 12px rgba(30,122,70,.25)}
.nav-cta:active{transform:scale(.97)}
@media (hover:hover) and (pointer:fine){
  .nav-links a:hover{color:var(--blue)}
  .nav-cta:hover{transform:translateY(-1px);box-shadow:0 7px 18px rgba(30,122,70,.32)}
}

/* ---- defter yaprağı ---- */
.sheet{
  position:relative;max-width:1180px;margin:0 auto;background:var(--paper);
  padding:44px clamp(24px,5vw,60px) 56px clamp(56px,8vw,100px);
  box-shadow:0 2px 6px rgba(25,29,38,.07),0 20px 48px rgba(25,29,38,.11);
  scroll-margin-top:calc(var(--nav-h) + 16px);
}
.sheet:first-of-type{margin-top:calc(var(--nav-h) + 28px)}
.sheet + .sheet{margin-top:32px}
.sheet::before{content:"";position:absolute;top:0;bottom:0;left:clamp(40px,6vw,68px);width:2px;background:var(--red);opacity:.65}
.holes{position:absolute;left:clamp(14px,2.6vw,28px);top:0;bottom:0;display:flex;flex-direction:column;justify-content:space-evenly;pointer-events:none}
.hole{width:16px;height:16px;border-radius:50%;background:var(--desk);box-shadow:inset 0 1px 3px rgba(25,29,38,.4)}
.antet{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:12px;margin-bottom:36px;font-family:"Spline Sans Mono",monospace;font-size:.74rem;font-weight:600;letter-spacing:.16em;color:var(--ink)}
.antet span:last-child{color:var(--ink-soft)}

h1{font-size:clamp(2.5rem,5.4vw,4.75rem);font-weight:900;letter-spacing:-.03em;line-height:1.04;margin:0 0 20px;text-wrap:balance}
h2{font-size:clamp(1.7rem,3.2vw,2.4rem);font-weight:800;letter-spacing:-.02em;line-height:1.1;margin:0 0 12px;text-wrap:balance}
.lead{font-size:1.08rem;line-height:1.65;color:var(--ink-soft);max-width:64ch;margin:0}
.lead strong{color:var(--ink)}

.defter-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(28px,4vw,52px);align-items:start}
.cta-row{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:28px}
.stamp-btn{
  display:inline-flex;align-items:center;gap:10px;background:var(--green);color:#fff;
  font-family:"Archivo",sans-serif;font-weight:700;font-size:.95rem;letter-spacing:.06em;text-transform:uppercase;
  padding:14px 24px;border:none;border-radius:6px;cursor:pointer;text-decoration:none;
  box-shadow:0 6px 16px rgba(30,122,70,.28);
  transition:transform 160ms var(--ease),box-shadow 160ms var(--ease);
}
.stamp-btn:active{transform:scale(.97)}
.btn-quiet{
  display:inline-flex;align-items:center;gap:8px;background:transparent;color:var(--ink);
  font-weight:700;font-size:.9rem;padding:12px 20px;border:2px solid var(--ink);border-radius:6px;
  cursor:pointer;text-decoration:none;transition:transform 160ms var(--ease),border-color 160ms,color 160ms;
}
.btn-quiet:active{transform:scale(.97)}
@media (hover:hover) and (pointer:fine){
  .stamp-btn:hover{transform:translateY(-1px);box-shadow:0 9px 22px rgba(30,122,70,.34)}
  .btn-quiet:hover{border-color:var(--blue);color:var(--blue)}
}
.entry-meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:26px;font-family:"Spline Sans Mono",monospace;font-size:.72rem;color:var(--ink-soft);letter-spacing:.04em}
.entry-meta b{color:var(--blue);font-weight:600}

/* ---- canlı demo defteri ---- */
.demo{border:2px solid var(--ink);border-radius:8px;background:var(--paper);overflow:hidden}
.demo-head{display:flex;justify-content:space-between;gap:10px;padding:11px 16px;border-bottom:2px solid var(--ink);font-family:"Spline Sans Mono",monospace;font-size:.7rem;font-weight:600;letter-spacing:.12em}
.demo-head span:last-child{color:var(--blue)}
.chain{list-style:none;margin:0;padding:0}
.chain-row{position:relative;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--rule);background-image:repeating-linear-gradient(to bottom,transparent 0 27px,var(--rule-soft) 27px 28px)}
.row-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.row-meta{font-family:"Spline Sans Mono",monospace;font-size:.68rem;color:var(--ink-soft);letter-spacing:.02em}
.row-summary{font-weight:700;font-size:.9rem}
.row-hash{display:inline-flex;align-items:center;gap:6px;font-family:"Spline Sans Mono",monospace;font-size:.7rem;color:var(--blue);white-space:nowrap}
.chain-row.tampered{background-color:rgba(180,83,9,.07)}
.chain-row.tampered .row-summary{text-decoration:underline wavy var(--amber);text-underline-offset:4px}
.chain-row.broken{background-color:rgba(201,58,46,.06)}
.row-stamp-slot{position:absolute;right:12px;top:-9px}
.stamp{display:inline-block;font-family:"Spline Sans Mono",monospace;font-weight:700;font-size:.62rem;letter-spacing:.1em;padding:2px 8px;border:2px solid currentColor;border-radius:4px;background:var(--paper);transform:rotate(-4deg);animation:stamp-in 200ms var(--ease) both}
.stamp.ok{color:var(--green)}
.stamp.bad{color:var(--red)}
.stamp.warn{color:var(--amber)}
@keyframes stamp-in{from{opacity:0;transform:rotate(-4deg) scale(.95)}to{opacity:1;transform:rotate(-4deg) scale(1)}}
.demo-controls{display:flex;flex-wrap:wrap;gap:8px;padding:14px 16px 10px;border-top:2px solid var(--ink)}
.ctrl{display:inline-flex;align-items:center;gap:6px;font-family:"Archivo",sans-serif;font-weight:600;font-size:.78rem;padding:8px 12px;border:1.5px solid var(--ink);border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;transition:transform 140ms var(--ease),border-color 140ms,color 140ms,background 140ms}
.ctrl:active{transform:scale(.97)}
.ctrl:disabled{opacity:.45;cursor:not-allowed}
@media (hover:hover) and (pointer:fine){
  .ctrl:hover:not(:disabled){border-color:var(--blue);color:var(--blue);background:rgba(36,71,201,.07)}
}
.demo-status{padding:0 16px 12px;font-family:"Spline Sans Mono",monospace;font-size:.72rem;color:var(--ink-soft);min-height:2.4em}
.demo-foot{display:flex;justify-content:flex-end;padding:0 16px 12px}
.reset-link{background:none;border:none;padding:2px 4px;color:var(--blue);font-size:.72rem;font-family:"Spline Sans Mono",monospace;text-decoration:underline;text-underline-offset:3px;cursor:pointer}

/* ---- nasıl işler ---- */
.steps{margin-top:28px}
.step{display:grid;grid-template-columns:64px minmax(0,1fr);gap:20px;padding:26px 0;border-bottom:1px solid var(--rule)}
.step:last-child{border-bottom:none}
.step-num{font-family:"Spline Sans Mono",monospace;font-weight:700;font-size:1.5rem;color:var(--blue);line-height:1.2}
.step h3{font-size:1.25rem;font-weight:800;letter-spacing:-.01em;margin:0 0 8px}
.step p{margin:0;color:var(--ink-soft);max-width:65ch}
.snippet{margin:14px 0 0;padding:14px 18px;background:#12151d;color:#e8eaf2;border-radius:8px;font-family:"Spline Sans Mono",monospace;font-size:.78rem;line-height:1.7;overflow-x:auto}
.snippet .tok{color:#8fb0ff}
.snippet .str{color:#9fd8a8}
.annotation{margin-top:32px;border:2px solid var(--ink);border-radius:8px;padding:20px 24px;background:rgba(36,71,201,.045)}
.annotation h3{margin:0 0 10px;font-size:1.05rem;font-weight:800}
.annotation ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px 28px}
.annotation li{display:flex;align-items:center;gap:8px;font-size:.9rem;color:var(--ink-soft)}
.annotation li svg{color:var(--green);flex:none}

/* ---- paketler ---- */
.tariff{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:28px;border-top:2px solid var(--ink)}
.plan{position:relative;padding:26px clamp(16px,2.4vw,30px) 30px;border-left:1px solid var(--rule)}
.plan:first-child{border-left:none}
.plan-name{font-size:1.25rem;font-weight:800;letter-spacing:-.01em;margin:0 0 4px}
.plan-for{font-size:.84rem;color:var(--ink-soft);margin:0 0 16px}
.plan-price{font-family:"Spline Sans Mono",monospace;font-weight:700;font-size:2.1rem;letter-spacing:-.02em;margin:0}
.plan-price small{font-size:.85rem;font-weight:400;color:var(--ink-soft);letter-spacing:0}
.plan ul{list-style:none;margin:18px 0 24px;padding:0;display:flex;flex-direction:column;gap:9px}
.plan li{display:flex;gap:9px;align-items:flex-start;font-size:.88rem;color:var(--ink-soft)}
.plan li svg{color:var(--green);flex:none;margin-top:3px}
.plan-flag{position:absolute;top:14px;right:14px}
.tariff-note{margin:22px 0 0;font-family:"Spline Sans Mono",monospace;font-size:.72rem;color:var(--ink-soft)}

/* ---- iletişim formu ---- */
.form-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(28px,4vw,52px);align-items:start;margin-top:24px}
.contact-form{display:grid;grid-template-columns:1fr 1fr;gap:22px 24px}
.field{display:flex;flex-direction:column;gap:6px}
.field.wide{grid-column:1 / -1}
.field label{font-family:"Spline Sans Mono",monospace;font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft)}
.field input,.field select,.field textarea{
  font-family:"Archivo",sans-serif;font-size:.98rem;color:var(--ink);
  background:transparent;border:none;border-bottom:2px solid var(--rule);
  padding:9px 2px;border-radius:0;transition:border-color 160ms var(--ease);
}
.field textarea{resize:vertical;min-height:96px;line-height:1.55}
.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-bottom-color:var(--blue)}
.field input::placeholder,.field textarea::placeholder{color:#6a7080}
.form-actions{grid-column:1 / -1;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.form-note{font-family:"Spline Sans Mono",monospace;font-size:.7rem;color:var(--ink-soft)}
.form-stamp{display:flex;gap:16px;align-items:flex-start;border:2px solid currentColor;border-radius:8px;padding:16px 18px;margin-bottom:24px}
.form-stamp.ok{color:var(--green)}
.form-stamp.warn{color:var(--amber)}
.form-stamp .stamp{font-size:.8rem;padding:6px 12px;flex:none;margin-top:2px}
.form-stamp p{margin:0;font-size:.9rem;color:var(--ink-soft)}
.form-stamp p b{display:block;color:var(--ink);font-size:1rem;margin-bottom:2px}
.form-aside{border-left:1px solid var(--rule);padding-left:clamp(18px,2.4vw,30px)}
.form-aside h3{margin:0 0 10px;font-size:1.05rem;font-weight:800}
.form-aside p{margin:0 0 14px;font-size:.9rem;color:var(--ink-soft);max-width:44ch}
.form-aside dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:.82rem}
.form-aside dt{font-family:"Spline Sans Mono",monospace;color:var(--blue);font-weight:600}
.form-aside dd{margin:0;color:var(--ink-soft)}

/* ---- alt şerit ---- */
.footer{max-width:1180px;margin:32px auto 48px;padding:20px clamp(24px,5vw,60px);display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;border-top:2px solid var(--ink);font-family:"Spline Sans Mono",monospace;font-size:.72rem;color:var(--ink-soft);letter-spacing:.06em}
.footer nav{display:flex;gap:18px;flex-wrap:wrap}
.footer a{color:var(--ink-soft);text-decoration:underline;text-underline-offset:3px}
@media (hover:hover) and (pointer:fine){.footer a:hover{color:var(--blue)}}

/* ---- giriş anı + erişilebilirlik ---- */
.rise{animation:rise 320ms var(--ease) both;animation-delay:var(--d,0ms)}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .rise{animation:fade-only 200ms both}
  .stamp{animation:fade-only 200ms both}
  @keyframes fade-only{from{opacity:0}to{opacity:1}}
  .stamp-btn,.btn-quiet,.ctrl,.nav-cta{transition:none}
  .stamp-btn:hover,.nav-cta:hover{transform:none}
}
@media (max-width:900px){
  .defter-grid,.form-grid{grid-template-columns:1fr}
  .form-aside{border-left:none;padding-left:0;border-top:1px solid var(--rule);padding-top:22px}
  .tariff{grid-template-columns:1fr}
  .plan{border-left:none;border-top:1px solid var(--rule)}
  .plan:first-child{border-top:none}
  .plan-flag{top:18px}
}
@media (max-width:600px){
  :root{--nav-h:96px}
  .nav{flex-wrap:wrap;height:auto;min-height:56px;padding:8px 16px;row-gap:2px}
  .brand{font-size:.8rem;letter-spacing:.1em}
  .nav-links{order:3;width:100%;margin-left:0;overflow:visible;flex-wrap:wrap;justify-content:space-between;gap:4px 10px}
  .nav-links a{font-size:.76rem;padding:4px 0}
  .nav-cta{margin-left:auto;padding:8px 12px;font-size:.72rem}
  .sheet{padding:32px 20px 44px 52px}
  .sheet::before{left:38px}
  .holes{left:12px}
  .hole{width:13px;height:13px}
  .antet{font-size:.62rem;letter-spacing:.1em;margin-bottom:26px}
  .contact-form{grid-template-columns:1fr}
  .form-stamp{flex-direction:column;align-items:flex-start;gap:10px}
  .step{grid-template-columns:44px minmax(0,1fr);gap:14px}
  .chain-row{flex-direction:column;align-items:flex-start;gap:6px}
  .row-stamp-slot{position:static;align-self:flex-end;margin-top:2px}
  .row-stamp-slot:empty{display:none}
  .ctrl{flex:1 1 auto;justify-content:center}
}
`;

const DEMO_JS = `
(function(){
  "use strict";
  var GENESIS = "0".repeat(64);
  var seeds = __SEEDS__;
  var pool = __POOL__;
  var rows = seeds.map(function(r){ return Object.assign({}, r, { tampered:false }); });
  var poolIndex = 0;
  var chainEl = document.getElementById("chain");
  var statusEl = document.getElementById("demo-status");
  var addBtn = document.getElementById("ctrl-add");
  var tamperBtn = document.getElementById("ctrl-tamper");
  var verifyBtn = document.getElementById("ctrl-verify");
  var resetBtn = document.getElementById("ctrl-reset");
  if(!chainEl || !statusEl) return;

  function sha256(text){
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function(buf){
      return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,"0"); }).join("");
    });
  }
  function contentOf(r){
    return r.date.replace(" ","T") + "Z|" + r.site + "|form:" + r.forms + "|cookie:" + r.cookies + "|onay:" + r.consents;
  }
  function summaryOf(r){
    return r.forms + " form · " + r.cookies + " çerez kategorisi · " + r.consents + " onay";
  }
  function setStatus(text){ statusEl.textContent = text; }

  function rowNode(r, i){
    var li = document.createElement("li");
    li.className = "chain-row" + (r.tampered ? " tampered" : "");
    li.dataset.index = String(i);
    var main = document.createElement("div"); main.className = "row-main";
    var meta = document.createElement("span"); meta.className = "row-meta";
    meta.textContent = r.date + " · " + r.site;
    var sum = document.createElement("span"); sum.className = "row-summary";
    sum.textContent = summaryOf(r);
    main.append(meta, sum);
    var hash = document.createElement("span"); hash.className = "row-hash";
    hash.title = r.hash;
    hash.innerHTML = __LINK_ICON__;
    var ht = document.createElement("span"); ht.className = "hash-text";
    ht.textContent = r.hash.slice(0,12) + "…";
    hash.append(ht);
    var slot = document.createElement("span"); slot.className = "row-stamp-slot";
    li.append(main, hash, slot);
    return li;
  }
  function render(){
    chainEl.textContent = "";
    rows.forEach(function(r,i){ chainEl.append(rowNode(r,i)); });
  }
  function stampAt(i, cls, text){
    var slot = chainEl.children[i] && chainEl.children[i].querySelector(".row-stamp-slot");
    if(!slot) return;
    slot.textContent = "";
    var s = document.createElement("span");
    s.className = "stamp " + cls;
    s.textContent = text;
    slot.append(s);
  }
  function clearStamps(){
    chainEl.querySelectorAll(".row-stamp-slot").forEach(function(s){ s.textContent = ""; });
    chainEl.querySelectorAll(".chain-row").forEach(function(li){ li.classList.remove("broken"); });
  }

  function addRow(){
    var p = pool[poolIndex % pool.length]; poolIndex++;
    var prev = rows.length ? rows[rows.length-1].hash : GENESIS;
    var r = Object.assign({}, p, { tampered:false });
    r.content = contentOf(r);
    sha256(prev + r.content).then(function(h){
      r.hash = h;
      rows.push(r);
      chainEl.append(rowNode(r, rows.length-1));
      stampAt(rows.length-1, "ok", "MÜHÜRLÜ");
      setStatus("Kayıt " + String(rows.length).padStart(3,"0") + " deftere işlendi — halka önceki kayda bağlandı.");
    });
  }
  function tamper(){
    var target = -1;
    for(var i=0;i<rows.length;i++){ if(!rows[i].tampered){ target = i; break; } }
    if(target === -1){ setStatus("Tüm kayıtlar kurcalandı — doğrulayıp farkı görün ya da defteri sıfırlayın."); return; }
    var r = rows[target];
    r.forms += 1;
    r.content = contentOf(r);
    r.tampered = true;
    var li = chainEl.children[target];
    li.classList.add("tampered");
    li.querySelector(".row-summary").textContent = summaryOf(r);
    clearStamps();
    setStatus("Kayıt " + String(target+1).padStart(3,"0") + " elle değiştirildi — hash eski. Zinciri doğrulayın.");
  }
  function verify(){
    clearStamps();
    var prev = GENESIS; var tasks = [];
    rows.forEach(function(r,i){
      var expectedPrev = prev;
      prev = r.hash;
      tasks.push(sha256(expectedPrev + r.content).then(function(h){
        var ok = h === r.hash;
        stampAt(i, ok ? "ok" : "bad", ok ? "DOĞRULANDI" : "MÜHÜR KIRIK");
        if(!ok) chainEl.children[i].classList.add("broken");
        return ok;
      }));
    });
    Promise.all(tasks).then(function(results){
      var okCount = results.filter(Boolean).length;
      var badCount = results.length - okCount;
      if(badCount === 0){
        setStatus(results.length + " kayıt doğrulandı — zincir bütün. Kurcalanan kayıt olsaydı halka kırılırdı.");
      } else {
        setStatus(okCount + " kayıt sağlam, " + badCount + " mühür kırık. Değişen kayıt zincirden hemen belli olur.");
      }
    });
  }
  function reset(){
    rows = seeds.map(function(r){ return Object.assign({}, r, { tampered:false }); });
    poolIndex = 0;
    render();
    setStatus("Defter sıfırlandı — iki örnek kayıt, gerçek sha256 halkaları.");
  }

  if(!(window.crypto && crypto.subtle)){
    [addBtn,tamperBtn,verifyBtn].forEach(function(b){ if(b) b.disabled = true; });
    if(resetBtn) resetBtn.hidden = true;
    setStatus("Canlı doğrulama bu tarayıcıda kapalı — defter salt okunur gösteriliyor.");
    return;
  }
  addBtn.addEventListener("click", addRow);
  tamperBtn.addEventListener("click", tamper);
  verifyBtn.addEventListener("click", verify);
  resetBtn.addEventListener("click", reset);
  setStatus("İki örnek kayıt zincirli. Ekleyin, kurcalayın, doğrulayın — hash'ler gerçek sha256.");
})();
`;

const NAV_JS = `
(function(){
  "use strict";
  // Yüklenişte hash varsa atlama anında olsun — uzun yumuşak kaydırma contact dönüşünü geciktirmesin.
  if(location.hash){
    document.documentElement.style.scrollBehavior = "auto";
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      document.documentElement.style.scrollBehavior = "";
    }); });
  }
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav-links a[href^='#']"));
  var sections = links.map(function(a){ return document.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);
  if(!("IntersectionObserver" in window) || !sections.length) return;
  var observer = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(!entry.isIntersecting) return;
      links.forEach(function(a){
        if(a.getAttribute("href") === "#" + entry.target.id) a.setAttribute("aria-current","true");
        else a.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-35% 0px -55% 0px" });
  sections.forEach(function(s){ observer.observe(s); });

  var select = document.querySelector("select[name='package']");
  document.querySelectorAll("[data-package]").forEach(function(el){
    el.addEventListener("click", function(){
      if(select){ select.value = el.getAttribute("data-package"); }
    });
  });
})();
`;

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function buildDemoJs(): string {
  return DEMO_JS.replace("__SEEDS__", jsonForScript(SEED_ROWS))
    .replace("__POOL__", jsonForScript(SAMPLE_POOL))
    .replace("__LINK_ICON__", JSON.stringify(icon("link", 13)));
}

/** CSP script-src hash'leri — gömülü script içeriği değişirse bu liste de değişir. */
export const LANDING_SCRIPT_HASHES: string[] = [buildDemoJs(), NAV_JS].map((s) =>
  createHash("sha256").update(s).digest("base64"),
);

export function renderLandingPage(options: LandingOptions = {}): string {
  const status = options.contactStatus;
  const stamp = status ? CONTACT_STAMPS[status] : null;
  const demoJs = buildDemoJs();

  const stampBlock = stamp
    ? `<div class="form-stamp ${stamp.cls}" role="status">
  <span class="stamp ${stamp.cls}">${stamp.title.toUpperCase()}</span>
  <p><b>${stamp.title}</b>${stamp.body}</p>
</div>`
    : "";

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Veriform — siteniz ne topluyor? Kanıtı defterde</title>
<meta name="description" content="Veriform, formlarınızı ve çerezlerinizi izler; her taramayı kurcalanamaz bir hash zincirine işler. KVKK uyumu için kanıt defteri — ajanslar ve site sahipleri için.">
<style>${CSS}</style>
</head>
<body>

<header class="nav">
  <a class="brand" href="#defter">VERİFORM<em>·</em>DEFTER</a>
  <nav class="nav-links" aria-label="Sayfa bölümleri">
    <a href="#defter">Başlangıç</a>
    <a href="#ihtiyac">Ne işe yarar</a>
    <a href="#nasil">Nasıl işler</a>
    <a href="#paketler">Paketler</a>
    <a href="#iletisim">İletişim</a>
    <a href="/tarama">Örnek tarama</a>
    <a href="/login">Giriş</a>
  </nav>
  <a class="nav-cta" href="/register">${icon("stamp", 15)} Hesap oluştur</a>
</header>

<main>
<section class="sheet" id="defter" aria-label="Uyum defteri — giriş">
  <div class="holes" aria-hidden="true"><span class="hole"></span><span class="hole"></span><span class="hole"></span></div>
  <div class="antet"><span>VERİFORM — UYUM DEFTERİ</span><span>SAYFA 01 · GİREN KAYIT</span></div>
  <div class="defter-grid">
    <div>
      <h1 class="rise">Siteniz ne topluyor? Görün, izni alın, uyumu kanıtlayın.</h1>
      <p class="lead rise" style="--d:60ms">Veriform sitenizdeki formları ve çerezleri tarar; hangilerinin kişisel veri topladığını raporlar. <strong>Tek satır kodla</strong> ziyaretçiden izin alırsınız; her tercih denetimde gösterilecek şekilde kayda geçer. Ajanslar müşterilerinin sitelerini tek panelden izler, değişiklikte uyarı alır. İzleyici <strong>ham veri saklamaz</strong>: form alanlarının adlarını ve çerez kategorilerini kaydeder, ziyaretçinin yazdığı içeriği değil.</p>
      <div class="cta-row rise" style="--d:120ms">
        <a class="stamp-btn" href="/register">${icon("stamp", 18)} Hesap oluştur</a>
        <a class="btn-quiet" href="/tarama">Örnek taramayı dene ${icon("arrow", 16)}</a>
      </div>
      <div class="entry-meta rise" style="--d:180ms">
        <span>KURULUM <b>tek satır kod</b></span>
        <span>VERİ <b>ham veri yok</b></span>
        <span>KANIT <b>denetime hazır</b></span>
        <span>UYUM <b>KVKK</b></span>
      </div>
    </div>
    <div class="demo rise" style="--d:140ms" aria-label="Canlı kanıt zinciri demosu">
      <div class="demo-head"><span>CANLI DEMO — ÖRNEK KAYITLAR</span><span>sha256</span></div>
      <ol class="chain" id="chain">
${SEED_ROWS.map(renderSeedRow).join("\n")}
      </ol>
      <div class="demo-controls">
        <button class="ctrl" id="ctrl-add" type="button">${icon("plus", 15)} Örnek tarama ekle</button>
        <button class="ctrl" id="ctrl-tamper" type="button">${icon("pencil", 15)} Kurcala</button>
        <button class="ctrl" id="ctrl-verify" type="button">${icon("shield", 15)} Zinciri doğrula</button>
      </div>
      <p class="demo-status" id="demo-status" aria-live="polite">Bu, denetimde göstereceğiniz kayıt zinciri. Ekleyin, kurcalayın, doğrulayın — bir kayıt değiştirilirse zincir kırılır.</p>
      <div class="demo-foot"><button class="reset-link" id="ctrl-reset" type="button">Defteri sıfırla</button></div>
    </div>
  </div>
</section>

<section class="sheet" id="ihtiyac" aria-label="Hangi ihtiyaçları karşılar">
  <div class="holes" aria-hidden="true"><span class="hole"></span><span class="hole"></span><span class="hole"></span></div>
  <div class="antet"><span>VERİFORM — UYUM DEFTERİ</span><span>SAYFA 02 · İHTİYAÇ</span></div>
  <h2>Hangi derdine derman?</h2>
  <p class="lead">Kişisel veri toplamak ve çerez kullanmak izne bağlı; izinsiz toplamak ceza sebebi. Veriform dört derdi tek panelde toplar.</p>
  <div class="steps">
    <div class="step">
      <span class="step-num" aria-hidden="true">01</span>
      <div>
        <h3>Sitemde ne toplandığını bilmiyorum</h3>
        <p>Site adresini gir, tarama raporu gelsin: hangi formlar var, hangi alanlar kişisel veri istiyor, hangi çerezler kuruluyor, veri hangi hedeflere gidiyor. Riskli olanlar işaretli.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num" aria-hidden="true">02</span>
      <div>
        <h3>Ziyaretçiden geçerli izin almam gerekiyor</h3>
        <p>Tek satır kodu sitene ekle; ziyaretçi çerez tercihini seçsin. Her tercih zaman damgasıyla kayda geçer — "izin aldım" demek yetmez, göstermek gerekir.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num" aria-hidden="true">03</span>
      <div>
        <h3>Denetimde ne göstereceğim?</h3>
        <p>Kayıtlar birbirine zincirlenir; sonradan değiştirilen kayıt doğrulamada yakalanır. Kanıtı CSV olarak indir, denetimde göster. Aydınlatma metni ve çerez politikası taslakları da panelde.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num" aria-hidden="true">04</span>
      <div>
        <h3>Müşteri siteleri değişince haberim olmuyor</h3>
        <p>Ajanslar müşterilerini tek panelden izler: siteler çizelgeyle otomatik taranır, yeni form veya çerez çıkınca e-posta uyarısı gelir. Veri sahibi başvurusu (silme, erişim) kendi formundan yürür, süresi takip edilir.</p>
      </div>
    </div>
  </div>
</section>

<section class="sheet" id="nasil" aria-label="Nasıl işler">
  <div class="holes" aria-hidden="true"><span class="hole"></span><span class="hole"></span><span class="hole"></span></div>
  <div class="antet"><span>VERİFORM — UYUM DEFTERİ</span><span>SAYFA 03 · İŞLEYİŞ</span></div>
  <h2>Üç adımda başlayın</h2>
  <p class="lead">Önce sitenizin ne topladığını görün, sonra tek satır kodla izni alın; gerisini panel biriktirir.</p>
  <div class="steps">
    <div class="step">
      <span class="step-num" aria-hidden="true">01</span>
      <div>
        <h3>Siteni ekle, ne topladığını gör</h3>
        <p>Panelde siteyi açın, <strong>Şimdi tara</strong> deyin. Rapor dakikalar içinde gelir: formlar, alan adları, çerez kategorileri, veri giden hedefler ve risk işaretleri. Ziyaretçinin yazdığı içerik hiçbir yere gönderilmez.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num" aria-hidden="true">02</span>
      <div>
        <h3>Tek satır kodu sitene ekle</h3>
        <p>Size verilen kod parçasını sitenizin <code>&lt;head&gt;</code> bölümüne ekleyin. Ziyaretçi çerez tercihini seçer, tercihi kayda geçer; panel bağlantıyı otomatik doğrular.</p>
        <pre class="snippet"><code>&lt;<span class="tok">script</span> <span class="tok">src</span>=<span class="str">"https://panel-adresiniz/embed.js"</span> <span class="tok">data-site-token</span>=<span class="str">"SİTE_TOKENINIZ"</span>&gt;&lt;/<span class="tok">script</span>&gt;</code></pre>
      </div>
    </div>
    <div class="step">
      <span class="step-num" aria-hidden="true">03</span>
      <div>
        <h3>Uyarıları al, kanıtı indir</h3>
        <p>Yeni form, kaldırılan alan ya da yeni çerez kategorisi çıkınca e-posta uyarısı gelir. Denetimde göstermek için kayıt zincirini CSV indirin; KVKK metin taslaklarını kullanın; veri sahibi başvuruları kendi formundan yürür.</p>
      </div>
    </div>
  </div>
  <div class="annotation">
    <h3>Sözümüz</h3>
    <ul>
      <li>${icon("check", 15)} Ham veri saklanmaz — yalnız alan adı ve kategori bilgisi</li>
      <li>${icon("check", 15)} Kayıtlar birbirine zincirlidir; sonradan kurcalama doğrulamada görünür</li>
      <li>${icon("check", 15)} Değişiklik sessizce geçmez — uyarı ve rapor üretir</li>
    </ul>
  </div>
</section>

<section class="sheet" id="paketler" aria-label="Paketler">
  <div class="holes" aria-hidden="true"><span class="hole"></span><span class="hole"></span><span class="hole"></span></div>
  <div class="antet"><span>VERİFORM — UYUM DEFTERİ</span><span>SAYFA 04 · TARİFE</span></div>
  <h2>Paketler</h2>
  <p class="lead">Tek siteniz de var, yüz müşteri siteniz de — aynı panel, farklı kapasite. Tüm paketlerde kayıt zinciri, uyarı mailleri ve KVKK taslakları vardır.</p>
  <div class="tariff">
    <div class="plan">
      <h3 class="plan-name">Starter</h3>
      <p class="plan-for">Kendi sitesini yönetenler için</p>
      <p class="plan-price">₺990<small> /ay</small></p>
      <ul>
        <li>${icon("check", 14)} 3 site</li>
        <li>${icon("check", 14)} Günlük otomatik tarama</li>
        <li>${icon("check", 14)} Kanıt zinciri + değişiklik uyarıları</li>
        <li>${icon("check", 14)} KVKK metin taslakları</li>
        <li>${icon("check", 14)} DSAR başvuru formu</li>
      </ul>
      <a class="btn-quiet" href="/register">Starter ile başla ${icon("arrow", 15)}</a>
    </div>
    <div class="plan">
      <span class="stamp ok plan-flag">AJANSLAR İÇİN</span>
      <h3 class="plan-name">Pro</h3>
      <p class="plan-for">Müşteri siteleri yöneten ajanslar için</p>
      <p class="plan-price">₺2.990<small> /ay</small></p>
      <ul>
        <li>${icon("check", 14)} 15 site</li>
        <li>${icon("check", 14)} Günlük tarama + anlık manuel tarama</li>
        <li>${icon("check", 14)} Müşteri bazlı panel ve raporlar</li>
        <li>${icon("check", 14)} Kanıt zinciri + değişiklik uyarıları</li>
        <li>${icon("check", 14)} KVKK taslakları + DSAR yönetimi</li>
      </ul>
      <a class="btn-quiet" href="/register">Pro ile başla ${icon("arrow", 15)}</a>
    </div>
    <div class="plan">
      <h3 class="plan-name">Ultimate</h3>
      <p class="plan-for">Çok siteli ajans ve özel kurulumlar için</p>
      <p class="plan-price">₺7.990<small> /ay</small></p>
      <ul>
        <li>${icon("check", 14)} Sınırsız site</li>
        <li>${icon("check", 14)} Pro'daki her şey</li>
        <li>${icon("check", 14)} API erişimi ve ingest anahtarları</li>
        <li>${icon("check", 14)} Özel tarama sıklığı</li>
        <li>${icon("check", 14)} Kurulum ve özelleştirme görüşmesi</li>
      </ul>
      <a class="stamp-btn" href="#iletisim" data-package="ultimate">${icon("stamp", 16)} İletişime geç</a>
    </div>
  </div>
  <p class="tariff-note">Erken erişim fiyatlarıdır — ödeme altyapısı açılana kadar kurulum ve faturalama kayıt sonrası görüşülür.</p>
</section>

<section class="sheet" id="iletisim" aria-label="İletişim">
  <div class="holes" aria-hidden="true"><span class="hole"></span><span class="hole"></span><span class="hole"></span></div>
  <div class="antet"><span>VERİFORM — UYUM DEFTERİ</span><span>SAYFA 05 · TALEP KAYDI</span></div>
  <h2>Bize yazın</h2>
  <p class="lead">Paket seçimi, kurulum yardımı ya da özel istek — formu doldurun, talebiniz kaydedilsin ve size dönelim.</p>
  <div class="form-grid">
    <div>
      ${stampBlock}
      <form class="contact-form" method="post" action="/contact">
        <div class="field">
          <label for="c-name">Ad soyad</label>
          <input id="c-name" name="name" type="text" required minlength="2" maxlength="120" autocomplete="name" placeholder="Adınız Soyadınız">
        </div>
        <div class="field">
          <label for="c-email">E-posta</label>
          <input id="c-email" name="email" type="email" required maxlength="254" autocomplete="email" placeholder="ad@ajans.com">
        </div>
        <div class="field">
          <label for="c-company">Şirket / ajans</label>
          <input id="c-company" name="company" type="text" maxlength="120" autocomplete="organization" placeholder="İsteğe bağlı">
        </div>
        <div class="field">
          <label for="c-package">Paket</label>
          <select id="c-package" name="package">
            <option value="">Henüz karar vermedim</option>
            <option value="starter">Starter — ₺990/ay</option>
            <option value="pro">Pro — ₺2.990/ay</option>
            <option value="ultimate">Ultimate — ₺7.990/ay</option>
          </select>
        </div>
        <div class="field wide">
          <label for="c-message">Mesaj</label>
          <textarea id="c-message" name="message" required minlength="10" maxlength="2000" placeholder="Kaç siteniz var, neye ihtiyacınız var — kısaca yazın."></textarea>
        </div>
        <div class="form-actions">
          <button class="stamp-btn" type="submit">${icon("stamp", 18)} Talebi mühürle</button>
          <span class="form-note">Talep kaydedilir ve operatöre e-posta ile iletilir.</span>
        </div>
      </form>
    </div>
    <aside class="form-aside">
      <h3>Formdan sonra ne olur?</h3>
      <p>Talebiniz iletişim defterine kaydedilir; operatör e-posta ile bilgilendirilir ve yazdığınız adresten dönüş yapılır.</p>
      <dl>
        <dt>Kayıt</dt><dd>Talep anında veritabanına işlenir</dd>
        <dt>Uyarı</dt><dd>Operatöre e-posta gider</dd>
        <dt>Dönüş</dt><dd>Kayıtlı e-posta adresinize yanıt yazılır</dd>
      </dl>
      <p style="margin-top:18px">Acelesi olanlar için: <a href="/register">defteri hemen açın</a>, kurulumu kendiniz yapın — iletişim formu beklemek zorunda değilsiniz.</p>
    </aside>
  </div>
</section>
</main>

<footer class="footer">
  <span>© 2026 VERİFORM — UYUM DEFTERİ</span>
  <nav aria-label="Alt bağlantılar">
    <a href="/tarama">Örnek tarama</a>
    <a href="/login">Giriş</a>
    <a href="/register">Kayıt</a>
    <a href="/kullanim-sartlari">Şartlar</a>
    <a href="/gizlilik">Gizlilik</a>
    <a href="/cerez-politikasi">Çerezler</a>
    <a href="#defter">Başa dön</a>
  </nav>
</footer>

<script>${demoJs}</script>
<script>${NAV_JS}</script>
</body>
</html>`;
}