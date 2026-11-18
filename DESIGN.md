---
name: Veriform — Zincir Defter
description: Turkish KVKK compliance SaaS presented as a physical evidence ledger — every scan a ruled entry, every entry sealed to the previous one with a sha256 link.
colors:
  paper: "#f6f7f4"
  desk: "#e7e9e2"
  ink: "#191d26"
  ink-soft: "#3f4553"
  ink-faint: "#6a7080"
  blue: "#2447c9"
  red: "#c93a2e"
  green: "#1e7a46"
  amber: "#b45309"
  rule: "rgba(36,71,201,.30)"
  rule-soft: "rgba(36,71,201,.13)"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5.4vw, 4.75rem)"
    fontWeight: 900
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.7rem, 3.2vw, 2.4rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  lead:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "0.7rem"
    fontWeight: 600
    letterSpacing: "0.12em"
  numeric:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "2.1rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "50%"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
  xl: "44px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "14px 24px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-ctrl:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-nav-cta:
    backgroundColor: "{colors.green}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "9px 2px"
  stamp-ok:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.green}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  stamp-bad:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.red}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  stamp-warn:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.amber}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "44px clamp(24px,5vw,60px) 56px clamp(56px,8vw,100px)"
  nav-bar:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    height: "64px"
---

# Design System: Veriform — Zincir Defter

## Overview

**Creative North Star: "Zincir Defter (The Chain Ledger)"**

The interface is not a website about a ledger; it is the ledger. The page background is a cool desk surface and every section is a sheet of Turkish registry paper lifted off it: a red margin line down the left, three binding holes punched through to the desk beneath, a letterspaced mono antet ("VERİFORM — UYUM DEFTERİ") closed by a folio ("SAYFA NN · …"), and content written as entries on blue ruling. The product's actual mechanism — a sha256 hash chain — runs live in the first viewport, so the visitor seals, tampers, and verifies records with their own hands before any claim is made. Persuasion is the artifact, not adjectives.

The palette behaves like stationery supplies, not brand paint: cold paper and desk neutrals, near-black ink for all prose, and chromatic color confined to the tools of the registry — the blue ruling pen, the red margin, the green seal, the amber warning, the red broken-seal stamp. Type splits by duty: Archivo (self-hosted variable, 100–900) speaks in heavy, tightly-tracked headlines and plain body; Spline Sans Mono (self-hosted variable, 300–700) records everything evidential — hashes, dates, prices, folios, labels. Motion is bureaucratic-physical: confirmations arrive as a kaşe stamp pressed at −4°, entries rise 10px into place, and every UI transition finishes within 160ms on a single decelerating curve.

Confirmed rejections: no fabricated customers, logos, or testimonials (PRODUCT.md brand commitment); no framework — the surface is a pure render function with inline CSS/JS.

**Key Characteristics:**
- Every section is a ledger sheet: red margin, binding holes, antet + folio, ruled rows.
- Text is achromatic ink; color lives only in rules, margin, stamps, links, and action fills.
- Evidence (hashes, dates, prices, meta, labels) is always Spline Sans Mono.
- The live hash-chain demo is the hero's right column — the mechanism is the pitch.
- One easing curve, ≤160ms UI transitions, stamps pressed at 200ms, entrances at 320ms.
- Browser chrome is themed: blue selection/caret/focus, blue-on-paper thin scrollbars.

## Colors

Stationery chromatics on cold registry paper — a ruling blue, a margin red, a seal green, a warning amber, and nothing else.

### Primary
- **Ruling Blue** (`colors.blue`, #2447c9): the Turkish ledger's ruling pen. Links, hash text, step numbers, active-nav underline, focus rings, caret, selection, scrollbar thumb, and the nav's 2px bottom border. Its alphas do the structural drawing: `colors.rule` (rgba(36,71,201,.30)) for row/step/plan divider lines and input underlines; `colors.rule-soft` (rgba(36,71,201,.13)) for the 28px repeating ruled-line gradient inside chain rows.
- **Seal Green** (`colors.green`, #1e7a46): the ink of an approved stamp. Fills the primary "mühür" buttons (nav CTA, "Defteri aç", "Talebi mühürle"), colors `ok` stamps, and tints every check icon. Its rgba shadows (see Elevation) are the only colored shadows in the system.

### Secondary
- **Margin Red** (`colors.red`, #c93a2e): the vertical margin line on every sheet (2px, opacity .65), the brand's interpunct, and the `bad` ("MÜHÜR KIRIK") stamp. A broken chain row washes with rgba(201,58,46,.06).
- **Warning Amber** (`colors.amber`, #b45309): the `warn` stamp and form-validation status block; a tampered row washes rgba(180,83,9,.07) and underlines its summary with a wavy amber line.

### Neutral
- **Ledger Paper** (`colors.paper`, #f6f7f4): every sheet, the fixed nav, stamp backgrounds, scrollbar track. The writing surface.
- **Desk** (`colors.desk`, #e7e9e2): the page body behind the sheets; also fills the binding holes so they read as punched through to the desk.
- **Registry Ink** (`colors.ink`, #191d26): all headings and body text, 2px ledger frames (antet rule, demo box, tariff top, footer top), quiet-button borders.
- **Soft Ink** (`colors.ink-soft`, #3f4553): leads, row meta, plan features, footer, inactive nav links — the secondary writing hand.
- **Faint Ink** (`colors.ink-faint`, #6a7080): input/textarea placeholder only.

### Named Rules
**The Achromatic Ink Rule.** Prose is never colored. Headings and body sit in ink/ink-soft; chromatic color appears only in ruling, margin, stamps, links, hashes, check icons, and solid action fills. If a paragraph is blue, it is wrong.
**The Blue Ruling Rule.** Thin structure is drawn with the blue alphas (`rule`, `rule-soft`); heavy 2px ink borders are reserved for ledger frames — the antet baseline, the demo box, the tariff top edge, the footer. Never mix the two weights on the same element.

## Typography

**Display Font:** Archivo (with system-ui, sans-serif) — self-hosted variable woff2, weights 100–900, latin + latin-ext unicode-range splits, font-display: swap.
**Body Font:** Archivo (same file).
**Label/Mono Font:** Spline Sans Mono (with ui-monospace, monospace) — self-hosted variable woff2, weights 300–700, same unicode-range splits.

**Character:** A heavy grotesque that argues plainly, paired with a monospace that records evidence. Archivo persuades; Spline Sans Mono testifies. The split is by duty, never by decoration.

### Hierarchy
- **Display** (900, clamp(2.5rem, 5.4vw, 4.75rem), 1.04, −0.03em, text-wrap: balance): the hero headline as the ledger's first entry. One per page.
- **Headline** (800, clamp(1.7rem, 3.2vw, 2.4rem), 1.1, −0.02em, balance): section titles under each antet.
- **Title** (800, 1.25rem, −0.01em): step and plan names; smaller 1.05rem/800 variants head the annotation box and form aside.
- **Body** (400, 16px, 1.6): default prose in ink; secondary prose in ink-soft capped at 65ch.
- **Lead** (400, 1.08rem, 1.65, ink-soft, max 64ch): the paragraph under each headline; `strong` inside returns to full ink.
- **Label** (Spline Sans Mono 600, 0.7rem, 0.12em, uppercase): form field labels; the antet runs the same voice at 0.74rem/0.16em, meta strips at 0.72rem/0.04em.
- **Numeric** (Spline Sans Mono 700, 2.1rem, −0.02em): plan prices; step numbers use the mono at 1.5rem/700 in ruling blue.

### Named Rules
**The Evidence Mono Rule.** Anything a registry would record — hashes, timestamps, site names, prices, folios, record numbers, field labels, status lines — is set in Spline Sans Mono. Anything it would argue is set in Archivo. Mono is never used for paragraphs of persuasion.

## Layout

The spatial model is a stack of paper sheets on a desk. Each sheet is max-width 1180px, centered, with asymmetric padding that honors the margin: 44px top, clamp(24px,5vw,60px) right, 56px bottom, clamp(56px,8vw,100px) left. Sheets sit calc(nav-height + 28px) below the fixed nav and 32px apart; anchor targets carry scroll-margin-top of calc(var(--nav-h) + 16px) so jumps land just below the bar. Inside a sheet, the hero and contact use a 7fr/5fr two-column grid (evidence column right) with clamp(28px,4vw,52px) gap; the tariff is three equal columns divided by 1px blue rules under a 2px ink top edge.

The nav is fixed at 64px (--nav-h), paper-filled with a 2px blue bottom border; an IntersectionObserver scrollspy (rootMargin −35%/−55%) sets aria-current, rendered as a 2px blue underline offset 6px. At ≤900px both grids and the tariff collapse to one column (plan dividers rotate from left borders to top borders; the form aside swaps its left rule for a top rule). At ≤600px --nav-h becomes 96px: the nav wraps to two rows with links on their own full-width row, sheet padding tightens to 32px 20px 44px 52px, the form goes single-column, chain rows stack vertically with the stamp slot moving in-flow, and demo controls flex to fill the row.

### Named Rules
**The Folio Rule.** Every section is a sheet and every sheet opens with the mono antet closed by its folio ("SAYFA NN · <purpose>"), carries the red margin line and three binding holes, and keeps content clear of the margin. A section without its antet is an unfinished page.

## Elevation & Depth

Depth is physical, not ambient: exactly one lift level exists — the paper sheet floating over the desk — plus the pressed-in binding holes and the small colored lift under seal buttons. Everything drawn on a sheet (rows, steps, plans, fields) is flat; separation comes from blue ruling and ink frames, never from shadows or tonal cards.

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 2px 6px rgba(25,29,38,.07), 0 20px 48px rgba(25,29,38,.11)`): the only neutral shadow; on every `.sheet`, nothing else.
- **Seal rest** (`box-shadow: 0 6px 16px rgba(30,122,70,.28)`): primary buttons at rest; the nav CTA uses a smaller cut (0 4px 12px rgba(30,122,70,.25)).
- **Seal hover** (`box-shadow: 0 9px 22px rgba(30,122,70,.34)`): primary buttons on fine-pointer hover, paired with translateY(−1px); nav CTA hover is 0 7px 18px rgba(30,122,70,.32).
- **Punched hole** (`box-shadow: inset 0 1px 3px rgba(25,29,38,.4)`): inset on the 16px desk-filled circles so holes read as cut through the paper.

### Named Rules
**The One Lifted Sheet Rule.** Only the sheet lifts off the desk and only seal-green buttons cast colored light. No card, row, input, or stamp ever gets a drop shadow; a stamp's authority comes from its border and rotation, not elevation.

## Shapes

Paper is square: sheets have no border-radius at all. Controls are barely softened — 6px on buttons and the scrollbar thumb, 8px on framed panels (demo box, code snippet, annotation box, form status block), 4px on the kaşe stamp. The only circles are the binding holes (50%). Frames are strokes, not fills: 2px ink for ledger frames, 2px currentColor for stamps and the form status block, 1.5px ink for demo controls, 1px blue-alpha for internal division. Fields have no box at all — just a 2px blue-alpha bottom rule that inks to solid blue on focus. The signature silhouette is the stamp: a small mono-caps plaque, 2px border in its own text color, rotated −4° as if pressed by hand.

## Components

### Buttons
- **Shape:** barely rounded (6px), inline-flex with 8–10px icon gap.
- **Primary ("mühür" seal button):** seal-green fill, white text, Archivo 700 at 0.95rem, 0.06em, uppercase, 14px 24px padding, seal-rest shadow. Hover (fine pointers only): translateY(−1px) + seal-hover shadow, 160ms. Active: scale(.97).
- **Quiet:** transparent, 2px ink border, ink text, Archivo 700 0.9rem, 12px 20px. Hover: border and text turn ruling blue. Active: scale(.97).
- **Demo control:** transparent, 1.5px ink border, Archivo 600 0.78rem, 8px 12px, 140ms transitions. Hover: blue border/text on a rgba(36,71,201,.07) wash. Disabled: opacity .45, not-allowed. Active: scale(.97).
- **Nav CTA:** the primary recipe shrunk — 9px 16px, 0.82rem, smaller shadow cut.

### Stamps (kaşe) — signature component
A verdict pressed onto the record: Spline Sans Mono 700, 0.62rem, 0.1em, 2px 8px, 2px currentColor border, 4px radius, paper background, rotate(−4deg). Three states: `ok` seal-green ("MÜHÜRLÜ", "DOĞRULANDI"), `bad` margin-red ("MÜHÜR KIRIK"), `warn` amber (form validation). Entrance is stamp-in: 200ms on the house curve, scale .95→1 plus opacity, rotation constant; under prefers-reduced-motion it becomes opacity-only at 200ms. On chain rows it hangs from an absolute slot at the row's top-right (top: −9px); at ≤600px the slot moves in-flow. The form status block scales the same stamp up (0.8rem, 6px 12px) inside a 2px currentColor frame with `role="status"`. The Pro plan's "AJANSLAR İÇİN" flag is a static ok-stamp pinned top-right.

### Ledger chain row
The evidence line: flex row on a repeating ruled background (transparent 0–27px, rule-soft 27–28px), 12px 16px padding, 1px rule bottom border. Left: mono meta (0.68rem, ink-soft — date · site) over an Archivo 700 0.9rem summary. Right: mono 0.7rem blue hash — link icon + first 12 hex chars + ellipsis, full hash in `title`. Tampered state: rgba(180,83,9,.07) wash + wavy amber underline on the summary. Broken state: rgba(201,58,46,.06) wash + bad stamp. The demo frame around rows is a 2px ink box (8px radius) with a mono demo-head, control row, and an aria-live mono status line (min-height 2.4em so verdicts never shift layout). Without crypto.subtle the controls disable and the seeded server-rendered chain stays readable.

### Inputs / Fields
- **Style:** no box — transparent background, zero radius, 2px rule bottom border, 9px 2px padding, Archivo 0.98rem ink. Label above in mono caps (label role). Placeholder in faint ink.
- **Focus:** outline suppressed; the bottom rule inks to solid blue (160ms). Global :focus-visible still gives other controls a 2px blue outline offset 2px.
- **Layout:** two-column grid (22px 24px gaps), textarea spans full width, min-height 96px, vertical resize only; single column at ≤600px.

### Navigation
Fixed 64px paper bar, 2px blue bottom border. Brand in mono 700 0.95rem, 0.14em, with a red interpunct. Links: Archivo 600 0.86rem ink-soft; hover blue (fine pointers); current section blue with 2px underline offset 6px via aria-current scrollspy. At ≤600px the bar wraps to two rows (96px total) with the link row full-width and space-between. Initial hash jumps are instant (smooth scroll temporarily disabled) so contact-form returns land immediately.

### Code snippet
The embed install line: near-black block (#12151d) with light text (#e8eaf2), 8px radius, mono 0.78rem/1.7, horizontal scroll; syntax tokens in soft blue (#8fb0ff) and soft green (#9fd8a8). These three colors are local to the snippet, not system tokens.

### Named Rules
**The Stamp Rule.** A verdict is a kaşe, not a toast: mono caps, 2px self-colored border, −4° rotation, pressed in at 200ms scale .95→1. Reduced motion keeps the verdict but drops the press to opacity-only.
**The 160ms Rule.** State transitions run ≤160ms (demo controls 140ms) on cubic-bezier(.23,1,.32,1); entrances may take 320ms with staggered delays (60ms steps). Hover effects exist only inside `@media (hover:hover) and (pointer:fine)`; every pressable control answers `:active` with scale(.97).

## Do's and Don'ts

### Do:
- **Do** keep all prose in ink/ink-soft and reserve chromatic color for ruling, margin, stamps, links, hashes, check icons, and action fills (the Achromatic Ink Rule).
- **Do** draw thin division with the blue alphas (rule / rule-soft) and reserve 2px ink strokes for ledger frames (the Blue Ruling Rule).
- **Do** set hashes, dates, prices, folios, meta, and field labels in Spline Sans Mono (the Evidence Mono Rule).
- **Do** give every section its sheet: red margin, three binding holes, antet + "SAYFA NN" folio (the Folio Rule).
- **Do** run UI transitions at ≤160ms on cubic-bezier(.23,1,.32,1), gate hover behind (hover:hover) and (pointer:fine), and answer :active with scale(.97).
- **Do** theme browser surfaces: blue selection with white text, blue caret, 2px blue focus-visible outline offset 2px, thin blue-on-paper scrollbars.
- **Do** provide the reduced-motion path: opacity-only stamp/rise at 200ms, transitions off, instant scrolling.
- **Do** keep the demo honest: real crypto.subtle sha256, server-rendered seed hashes readable without JS, controls disabled with an explanatory status when crypto is unavailable.

### Don't:
- **Don't** color body text, tint sheet surfaces, or add colored cards — the sheet stays flat paper; the only background washes are the tampered/broken row states and the annotation's faint blue rgba(36,71,201,.045).
- **Don't** round the sheet or go past 8px radius anywhere; paper is square, controls are 4–8px, only binding holes are circular.
- **Don't** shadow anything except the sheet and seal-green buttons (the One Lifted Sheet Rule); stamps and rows carry no elevation.
- **Don't** use decorative color gradients, glass, or blur — the only gradient in the system is the ruled-line repeating-linear-gradient inside chain rows.
- **Don't** stretch UI transitions past 160ms or animate hover on touch; entrances (320ms) and the stamp press (200ms) are the only longer motions.
- **Don't** substitute system display faces or remote font CDNs — Archivo and Spline Sans Mono are self-hosted variable woff2 with latin/latin-ext splits.
- **Don't** fabricate customer logos, testimonials, or benchmark numbers (PRODUCT.md: none exist; the live mechanism is the only proof).