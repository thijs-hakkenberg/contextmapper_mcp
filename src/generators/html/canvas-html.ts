/**
 * Bounded Context Canvas (v5) as a self-contained HTML page.
 *
 * Layout and guidance follow the Bounded Context Canvas by the DDD Crew
 * (https://github.com/ddd-crew/bounded-context-canvas, CC BY-SA 4.0).
 */

import type { CanvasCollaboration, CanvasMessage } from '../../model/types.js';
import { CANVAS_DOMAINS, CANVAS_BUSINESS_MODELS, CANVAS_EVOLUTIONS, type ResolvedCanvas } from '../../model/canvas.js';
import { escapeHtml, htmlPage } from './common.js';

export interface CanvasHtmlOptions {
  /** Relative link back to the context map page */
  contextMapHref?: string;
  /** Name of the model, shown in the navigation */
  modelName?: string;
}

const DOMAIN_ROLE_EXAMPLES = ['draft context', 'execution context', 'analysis context', 'gateway context', 'other'];

const CSS = `
.canvas {
  background: var(--surface);
  border: 3px solid var(--line);
  display: grid;
  grid-template-columns: minmax(0, 45fr) minmax(0, 37fr) minmax(0, 18fr);
}
.cell { padding: 14px 18px 18px; border-color: var(--line); border-style: solid; border-width: 0; min-width: 0; }
.cell h2 { margin: 0 0 8px; font-size: 21px; font-weight: 700; letter-spacing: -0.01em; }
.cell h3 { margin: 0 0 4px; font-size: 13px; font-weight: 700; color: var(--ink-2); }
.guide { color: var(--ink-3); font-size: 14px; margin: 0; }
.head { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom-width: 2px; }
.head h1 { margin: 0; font-size: 30px; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.head h1 .label { color: var(--ink-3); font-weight: 400; }
.head .source { font-size: 12px; color: var(--ink-3); text-align: right; white-space: nowrap; }
.purpose { border-bottom-width: 2px; border-right-width: 2px; }
.purpose p.text { margin: 0; font-size: 16px; white-space: pre-line; }
.classification { border-bottom-width: 2px; border-right-width: 2px; }
.roles { border-bottom-width: 2px; }
.dims { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.options { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.options li { font-size: 13px; color: var(--ink-3); padding: 1px 8px; border-radius: 999px; border: 1px solid transparent; width: fit-content; }
.options li.on { color: var(--selected-ink); background: var(--selected); font-weight: 700; }
.options li.on::before { content: "\\2713\\00a0"; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 13px; padding: 2px 10px; border-radius: 999px; background: var(--selected); color: var(--selected-ink); font-weight: 700; }
.middle { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 37fr) minmax(0, 26fr) minmax(0, 37fr); border-bottom: 2px solid var(--line); }
.comm .cols { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 10px; font-size: 13px; font-weight: 700; color: var(--ink-3); margin-bottom: 6px; }
.outbound .cols { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
.flow { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 10px; align-items: start; padding: 10px 0; border-top: 1px dashed var(--line-soft); position: relative; }
.outbound .flow { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
.flow::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; }
.collaborator { padding: 7px 9px; border: 1.5px solid var(--line); border-radius: 4px; background: var(--surface); }
.collaborator .n { font-weight: 700; overflow-wrap: anywhere; }
.collaborator .t { font-size: 12px; color: var(--ink-2); }
.collaborator .r { font-size: 12px; color: var(--ink-2); font-style: italic; margin-top: 2px; }
.stickies { display: flex; flex-wrap: wrap; gap: 6px; align-content: flex-start; }
.outbound .stickies { justify-content: flex-end; }
.sticky { font-size: 12.5px; padding: 6px 8px; min-width: 76px; max-width: 100%; border: 1.5px solid; border-radius: 2px; overflow-wrap: anywhere; box-shadow: 0 1px 0 rgba(0,0,0,.08); }
.sticky .k { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; opacity: .7; }
.sticky.query { background: var(--query); border-color: var(--query-edge); }
.sticky.command { background: var(--command); border-color: var(--command-edge); }
.sticky.event { background: var(--event); border-color: var(--event-edge); }
.sticky.decision { background: var(--decision); border-color: var(--decision-edge); font-size: 13px; }
.arrow { grid-column: 1 / -1; height: 14px; position: relative; margin-top: 2px; }
.arrow::before { content: ""; position: absolute; left: 0; right: 14px; top: 4px; height: 6px; background: var(--line-soft); }
.arrow::after { content: ""; position: absolute; right: 0; top: 0; border-left: 14px solid var(--line-soft); border-top: 7px solid transparent; border-bottom: 7px solid transparent; }
.center { padding: 14px 10px; }
.center-box { border: 2px solid var(--ink-3); padding: 14px; height: 100%; display: flex; flex-direction: column; gap: 18px; }
.center-box h2 { text-align: center; margin-bottom: 0; }
.center-box .sub { text-align: center; font-size: 13px; font-weight: 700; color: var(--ink-2); margin: 0 0 10px; }
.terms { display: flex; flex-direction: column; gap: 6px; }
.term { border: 1.5px dashed var(--ink-3); background: var(--term); padding: 6px 9px; font-size: 13px; overflow-wrap: anywhere; }
.term b { display: block; }
.decisions { display: flex; flex-direction: column; gap: 6px; }
.bottom { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 45fr) minmax(0, 37fr) minmax(0, 18fr); }
.bottom .cell:not(:last-child) { border-right-width: 2px; }
ul.items { margin: 0; padding-left: 18px; }
ul.items li { margin: 3px 0; }
.legend { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; font-size: 12px; color: var(--ink-2); }
.legend .sticky { min-width: 0; padding: 1px 6px; font-size: 11px; }
@media (max-width: 900px) {
  .canvas, .middle, .bottom { grid-template-columns: minmax(0, 1fr); }
  .cell { border-right-width: 0 !important; border-bottom-width: 2px; }
  .head { flex-direction: column; align-items: flex-start; }
  .head .source { text-align: left; white-space: normal; }
  .dims { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
}
@media print {
  .canvas { font-size: 12px; }
  .sticky, .options li.on, .chip { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

function guide(text: string): string {
  return `<p class="guide">${escapeHtml(text)}</p>`;
}

function textList(items: string[] | undefined, guidance: string): string {
  if (!items || items.length === 0) return guide(guidance);
  return `<ul class="items">${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

function optionList(title: string, all: readonly string[], selected: string[] | undefined): string {
  const chosen = new Set(selected ?? []);
  const extra = [...chosen].filter(v => !all.includes(v));
  return `<div><h3>${escapeHtml(title)}</h3><ul class="options">${[...all, ...extra]
    .map(v => `<li class="${chosen.has(v) ? 'on' : ''}">${escapeHtml(v)}</li>`)
    .join('')}</ul></div>`;
}

function sticky(message: CanvasMessage): string {
  return `<div class="sticky ${escapeHtml(message.type)}"><span class="k">${escapeHtml(message.type)}</span>${escapeHtml(message.name)}</div>`;
}

/** Order stickies as on the canvas: queries, commands, events */
function sortedMessages(messages: CanvasMessage[] | undefined): CanvasMessage[] {
  const order = { query: 0, command: 1, event: 2 } as Record<string, number>;
  return [...(messages ?? [])].sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3));
}

function collaboratorCard(c: CanvasCollaboration): string {
  return `<div class="collaborator"><div class="n">${escapeHtml(c.collaborator)}</div>${
    c.type ? `<div class="t">${escapeHtml(c.type)}</div>` : ''
  }${c.relationship ? `<div class="r">${escapeHtml(c.relationship)}</div>` : ''}</div>`;
}

function communication(direction: 'inbound' | 'outbound', list: CanvasCollaboration[] | undefined): string {
  const title = direction === 'inbound' ? 'Inbound Communication' : 'Outbound Communication';
  const cols = direction === 'inbound' ? '<span>Collaborator</span><span>Messages</span>' : '<span>Messages</span><span style="text-align:right">Collaborator</span>';

  let flows: string;
  if (!list || list.length === 0) {
    flows = guide(
      direction === 'inbound'
        ? 'Which collaborators initiate communication with this context, and with which commands, queries and events?'
        : 'Which collaborators does this context initiate communication with, and with which commands, queries and events?'
    );
  } else {
    flows = list
      .map(c => {
        const messages = sortedMessages(c.messages);
        const stickies = `<div class="stickies">${messages.length > 0 ? messages.map(sticky).join('') : '<span class="muted" style="font-size:13px">no messages listed</span>'}</div>`;
        const card = collaboratorCard(c);
        const inner = direction === 'inbound' ? card + stickies : stickies + card;
        return `<div class="flow">${inner}<div class="arrow" aria-hidden="true"></div></div>`;
      })
      .join('');
  }

  return `<section class="cell comm ${direction}" aria-label="${title}"><h2>${title}</h2><div class="cols">${cols}</div>${flows}</section>`;
}

/** Render a resolved canvas as a full HTML page */
export function renderCanvasHtml(canvas: ResolvedCanvas, options: CanvasHtmlOptions = {}): string {
  const sc = canvas.strategicClassification ?? {};

  const terms = canvas.ubiquitousLanguage?.length
    ? `<div class="terms">${canvas.ubiquitousLanguage
        .map(t => `<div class="term"><b>${escapeHtml(t.term)}</b>${t.definition ? escapeHtml(t.definition) : ''}</div>`)
        .join('')}</div>`
    : guide('Key domain terms used in this context, with their definitions.');

  const decisions = canvas.businessDecisions?.length
    ? `<div class="decisions">${canvas.businessDecisions.map(d => `<div class="sticky decision">${escapeHtml(d)}</div>`).join('')}</div>`
    : guide('Key business rules, policies and decisions.');

  const roles = canvas.domainRoles?.length
    ? `<div class="chips">${canvas.domainRoles.map(r => `<span class="chip">${escapeHtml(r)}</span>`).join('')}</div>`
    : `<h3>Role types</h3><ul class="options">${DOMAIN_ROLE_EXAMPLES.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`;

  const nav =
    options.contextMapHref || options.modelName
      ? `<nav class="topnav no-print">${
          options.contextMapHref ? `<a href="${escapeHtml(options.contextMapHref)}">&larr; Context map${options.modelName ? ` · ${escapeHtml(options.modelName)}` : ''}</a>` : `<span>${escapeHtml(options.modelName)}</span>`
        }<div class="legend"><span class="sticky query">query</span><span class="sticky command">command</span><span class="sticky event">event</span><span class="sticky decision">decision</span></div></nav>`
      : '';

  const body = `<div class="page">
${nav}
<main class="canvas">
  <header class="cell head">
    <h1><span class="label">Name:</span> ${escapeHtml(canvas.name)}</h1>
    <div class="source">Bounded Context Canvas v5<br><a href="https://github.com/ddd-crew/bounded-context-canvas">github.com/ddd-crew/bounded-context-canvas</a></div>
  </header>
  <section class="cell purpose" aria-label="Purpose">
    <h2>Purpose</h2>
    ${canvas.purpose ? `<p class="text">${escapeHtml(canvas.purpose)}</p>` : guide('What benefits does this context provide, and how does it provide them? Describe the purpose from a business perspective.')}
  </section>
  <section class="cell classification" aria-label="Strategic Classification">
    <h2>Strategic Classification</h2>
    <div class="dims">
      ${optionList('Domain', CANVAS_DOMAINS, sc.domain)}
      ${optionList('Business Model', CANVAS_BUSINESS_MODELS, sc.businessModel)}
      ${optionList('Evolution', CANVAS_EVOLUTIONS, sc.evolution)}
    </div>
  </section>
  <section class="cell roles" aria-label="Domain Roles">
    <h2>Domain Roles</h2>
    ${roles}
  </section>
  <div class="middle">
    ${communication('inbound', canvas.inboundCommunication)}
    <div class="center">
      <div class="center-box">
        <section aria-label="Ubiquitous Language">
          <h2>Ubiquitous Language</h2>
          <p class="sub">Context-specific domain terminology</p>
          ${terms}
        </section>
        <section aria-label="Business Decisions">
          <h2>Business Decisions</h2>
          <p class="sub">Key business rules, policies, and decisions</p>
          ${decisions}
        </section>
      </div>
    </div>
    ${communication('outbound', canvas.outboundCommunication)}
  </div>
  <div class="bottom">
    <section class="cell" aria-label="Assumptions">
      <h2>Assumptions</h2>
      ${textList(canvas.assumptions, 'Which currently unverified assumptions went into this bounded context design? Make them explicit here.')}
    </section>
    <section class="cell" aria-label="Verification Metrics">
      <h2>Verification Metrics</h2>
      ${textList(canvas.verificationMetrics, 'Which metrics can be used to (in)validate the current boundaries of this context?')}
    </section>
    <section class="cell" aria-label="Open Questions">
      <h2>Open Questions</h2>
      ${textList(canvas.openQuestions, 'Which questions could no one answer yet?')}
    </section>
  </div>
</main>
<footer class="page-footer">Based on the <a href="https://github.com/ddd-crew/bounded-context-canvas">Bounded Context Canvas</a> by the DDD Crew, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Generated by context-mapper-mcp.</footer>
</div>`;

  return htmlPage({
    title: `${canvas.name} · Bounded Context Canvas`,
    description: canvas.purpose,
    css: CSS,
    body,
  });
}
