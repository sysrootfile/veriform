/**
 * Taslak çıktısını yazdırılabilir HTML'e çevirir — minimal markdown:
 * "# "/"## " başlık, "- " liste, "**kalın**", "> " alıntı. Tüm metin önce kaçırılır.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inline(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function markdownToHtml(markdown: string): string {
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length) {
      blocks.push(`<ul>${listItems.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
      listItems = [];
    }
  };

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      continue;
    }
    flushList();
    if (line.startsWith("## ")) blocks.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) blocks.push(`<h1>${inline(line.slice(2))}</h1>`);
    else if (line.startsWith("> ")) blocks.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    else if (line.trim() !== "") blocks.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return blocks.join("\n");
}

export function renderDraftPageHtml(input: {
  title: string;
  markdown: string;
  version: string;
}): string {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Veriform Taslak — ${escapeHtml(input.title)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a2e; line-height: 1.55; }
  h1 { font-size: 1.35rem; } h2 { font-size: 1.1rem; margin-top: 1.5rem; }
  blockquote { background: #fdf2e3; border-left: 4px solid #b45309; margin: 0; padding: .6rem 1rem; font-size: .9rem; }
  .meta { color: #888; font-size: .8rem; border-top: 1px solid #eee; margin-top: 2rem; padding-top: .8rem; }
  @media print { .meta { color: #555; } }
</style>
</head>
<body>
${markdownToHtml(input.markdown)}
<p class="meta">Şablon sürümü: ${escapeHtml(input.version)} · Veriform taslak üreticisi</p>
</body>
</html>`;
}
