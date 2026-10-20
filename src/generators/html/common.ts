/**
 * Shared helpers for the self-contained HTML generators
 */

export function escapeHtml(text: string | undefined | null): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON that is safe to embed inside a <script> element */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** File name for a bounded context's canvas page */
export function canvasFileName(contextName: string, extension = 'html'): string {
  const slug = contextName.replace(/[^0-9A-Za-z_-]+/g, '_').replace(/^_+|_+$/g, '') || 'context';
  return `${slug}.${extension}`;
}

/** Colour tokens shared by all pages, with a dark variant */
const BASE_CSS = `
:root {
  color-scheme: light dark;
  --bg: #f6f5f1;
  --surface: #ffffff;
  --surface-2: #f0efea;
  --ink: #1d1d1b;
  --ink-2: #57564f;
  --ink-3: #8a897f;
  --line: #1d1d1b;
  --line-soft: #d9d7cd;
  --accent: #2f5d8a;
  --query: #dff0b8;   --query-edge: #9cc25a;
  --command: #cfe2f7; --command-edge: #6d9fd4;
  --event: #fbeab0;   --event-edge: #e2c14d;
  --decision: #e4dcf0; --decision-edge: #9a7cc4;
  --term: #f1f0ec;
  --core: #2f5d8a; --supporting: #6f8fae; --generic: #a7b1ba; --other: #b9a98c;
  --selected: #1d1d1b; --selected-ink: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #171716; --surface: #201f1d; --surface-2: #2a2926;
    --ink: #ecebe5; --ink-2: #b4b2a8; --ink-3: #85837a;
    --line: #ecebe5; --line-soft: #3d3c37; --accent: #8db5e0;
    --query: #3c4a22; --query-edge: #7f9f43;
    --command: #22384f; --command-edge: #5a88b8;
    --event: #4d4120; --event-edge: #b8973a;
    --decision: #3a3049; --decision-edge: #8c72b3;
    --term: #2a2926;
    --core: #8db5e0; --supporting: #6f8fae; --generic: #6d757c; --other: #8f8167;
    --selected: #ecebe5; --selected-ink: #171716;
  }
}
:root[data-theme="dark"] {
  --bg: #171716; --surface: #201f1d; --surface-2: #2a2926;
  --ink: #ecebe5; --ink-2: #b4b2a8; --ink-3: #85837a;
  --line: #ecebe5; --line-soft: #3d3c37; --accent: #8db5e0;
  --query: #3c4a22; --query-edge: #7f9f43;
  --command: #22384f; --command-edge: #5a88b8;
  --event: #4d4120; --event-edge: #b8973a;
  --decision: #3a3049; --decision-edge: #8c72b3;
  --term: #2a2926;
  --core: #8db5e0; --supporting: #6f8fae; --generic: #6d757c; --other: #8f8167;
  --selected: #ecebe5; --selected-ink: #171716;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 15px/1.45 "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif;
}
a { color: var(--accent); }
.page { max-width: 1480px; margin: 0 auto; padding: 24px 16px 40px; }
.topnav { display: flex; gap: 16px; align-items: baseline; justify-content: space-between; flex-wrap: wrap; margin-bottom: 14px; font-size: 13px; color: var(--ink-2); }
.page-footer { margin-top: 18px; font-size: 12px; color: var(--ink-3); }
.muted { color: var(--ink-3); }
@media print {
  @page { size: landscape; margin: 10mm; }
  body { background: #fff; }
  .page { max-width: none; padding: 0; }
  .no-print { display: none !important; }
}
`;

export function htmlPage(options: { title: string; css: string; body: string; script?: string; description?: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="context-mapper-mcp">
${options.description ? `<meta name="description" content="${escapeHtml(options.description)}">\n` : ''}<title>${escapeHtml(options.title)}</title>
<style>${BASE_CSS}${options.css}</style>
</head>
<body>
${options.body}
${options.script ? `<script>${options.script}</script>\n` : ''}</body>
</html>
`;
}
