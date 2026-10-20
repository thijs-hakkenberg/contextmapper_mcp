/**
 * Context Map as a self-contained, interactive HTML page.
 *
 * The layout is computed here (layered: upstream contexts above their downstreams) and
 * inlined as SVG, so the page works offline and needs no external libraries.
 */

import type { CMLModel, BoundedContext, ContextRelationship } from '../../model/types.js';
import { resolveCanvas } from '../../model/canvas.js';
import { escapeHtml, htmlPage, jsonForScript } from './common.js';

export interface ContextMapHtmlOptions {
  /** Link each context to its canvas page; maps context name -> relative href */
  canvasHrefs?: Record<string, string>;
}

interface Point { x: number; y: number }

interface LayoutNode {
  bc: BoundedContext;
  index: number;
  rank: number;
  order: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutEdge {
  rel: ContextRelationship;
  index: number;
  from: LayoutNode;
  to: LayoutNode;
  points: Point[];
  fromBadge?: { at: Point; text: string };
  toBadge?: { at: Point; text: string };
  label?: { at: Point; text: string };
}

const NODE_H = 72;
const H_GAP = 90;
const V_GAP = 150;

function nodeWidth(bc: BoundedContext): number {
  return Math.max(160, Math.min(300, bc.name.length * 9.5 + 48));
}

function relEnds(rel: ContextRelationship): [string, string] {
  return rel.type === 'UpstreamDownstream' ? [rel.upstream, rel.downstream] : [rel.participant1, rel.participant2];
}

/** Bounded contexts to draw: those on the context map, or all of them when there is no map */
function contextsOnMap(model: CMLModel): BoundedContext[] {
  const names = model.contextMap?.boundedContexts;
  if (!names || names.length === 0) return model.boundedContexts;
  const onMap = names.map(n => model.boundedContexts.find(bc => bc.name === n)).filter((bc): bc is BoundedContext => !!bc);
  return onMap.length > 0 ? onMap : model.boundedContexts;
}

/** Layered layout: rank by longest upstream path, order ranks by barycenter to reduce crossings */
function layoutNodes(contexts: BoundedContext[], relationships: ContextRelationship[]): LayoutNode[] {
  const nodes: LayoutNode[] = contexts.map((bc, index) => ({ bc, index, rank: 0, order: index, x: 0, y: 0, w: nodeWidth(bc), h: NODE_H }));
  const byName = new Map(nodes.map(n => [n.bc.name, n]));
  const n = nodes.length;

  const ud = relationships.filter(r => r.type === 'UpstreamDownstream') as Extract<ContextRelationship, { type: 'UpstreamDownstream' }>[];
  const hasUd = new Set<string>();
  for (const r of ud) {
    hasUd.add(r.upstream);
    hasUd.add(r.downstream);
  }

  // Longest-path ranking; the rank cap keeps cycles from looping forever
  for (let iter = 0; iter < n; iter++) {
    let changed = false;
    for (const r of ud) {
      const u = byName.get(r.upstream);
      const d = byName.get(r.downstream);
      if (u && d && u !== d && d.rank < u.rank + 1 && u.rank + 1 < n) {
        d.rank = u.rank + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Contexts only in symmetric relationships sit next to their partner
  for (const r of relationships) {
    if (r.type === 'UpstreamDownstream') continue;
    const a = byName.get(r.participant1);
    const b = byName.get(r.participant2);
    if (!a || !b) continue;
    if (hasUd.has(a.bc.name) && !hasUd.has(b.bc.name)) b.rank = a.rank;
    else if (hasUd.has(b.bc.name) && !hasUd.has(a.bc.name)) a.rank = b.rank;
  }

  // Compact ranks so there are no empty rows
  const usedRanks = [...new Set(nodes.map(nd => nd.rank))].sort((a, b) => a - b);
  for (const nd of nodes) nd.rank = usedRanks.indexOf(nd.rank);
  const rankCount = usedRanks.length;

  const neighbours = new Map<LayoutNode, LayoutNode[]>(nodes.map(nd => [nd, []]));
  for (const r of relationships) {
    const [a, b] = relEnds(r).map(name => byName.get(name));
    if (a && b && a !== b) {
      neighbours.get(a)!.push(b);
      neighbours.get(b)!.push(a);
    }
  }

  const rows: LayoutNode[][] = Array.from({ length: rankCount }, (_, rank) => nodes.filter(nd => nd.rank === rank));
  const reorder = (row: LayoutNode[], refRank: number) => {
    const bary = new Map<LayoutNode, number>();
    for (const nd of row) {
      const refs = neighbours.get(nd)!.filter(m => m.rank === refRank);
      bary.set(nd, refs.length > 0 ? refs.reduce((s, m) => s + m.order, 0) / refs.length : nd.order);
    }
    row.sort((a, b) => bary.get(a)! - bary.get(b)! || a.index - b.index);
    row.forEach((nd, i) => (nd.order = i));
  };
  rows.forEach(row => row.forEach((nd, i) => (nd.order = i)));
  for (let sweep = 0; sweep < 4; sweep++) {
    for (let r = 1; r < rankCount; r++) reorder(rows[r], r - 1);
    for (let r = rankCount - 2; r >= 0; r--) reorder(rows[r], r + 1);
  }

  // Centre each row horizontally
  const rowWidths = rows.map(row => row.reduce((s, nd) => s + nd.w, 0) + H_GAP * Math.max(0, row.length - 1));
  const maxWidth = Math.max(0, ...rowWidths);
  rows.forEach((row, r) => {
    let x = (maxWidth - rowWidths[r]) / 2;
    for (const nd of row) {
      nd.x = x + nd.w / 2;
      nd.y = r * (NODE_H + V_GAP) + NODE_H / 2;
      x += nd.w + H_GAP;
    }
  });

  return nodes;
}

function quad(p0: Point, c: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y };
}

function inside(p: Point, nd: LayoutNode, pad = 2): boolean {
  return Math.abs(p.x - nd.x) <= nd.w / 2 + pad && Math.abs(p.y - nd.y) <= nd.h / 2 + pad;
}

/** Point at a given arc length along a polyline, and the direction there */
function along(points: Point[], distance: number): { at: Point; dir: Point } {
  let remaining = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    if (remaining <= len || i === points.length - 1) {
      const t = Math.min(1, remaining / len);
      return { at: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dir };
    }
    remaining -= len;
  }
  return { at: points[0], dir: { x: 1, y: 0 } };
}

function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return len;
}

function badgeWidth(text: string): number {
  return text.length * 7 + 16;
}

/** Place a badge just outside a node boundary, along the edge */
function badgeAt(points: Point[], text: string, fromEnd: boolean): Point {
  const pts = fromEnd ? [...points].reverse() : points;
  const { dir } = along(pts, 0);
  const halfExtent = (Math.abs(dir.x) * badgeWidth(text)) / 2 + (Math.abs(dir.y) * 22) / 2;
  return along(pts, halfExtent + 6).at;
}

function layoutEdges(nodes: LayoutNode[], relationships: ContextRelationship[]): LayoutEdge[] {
  const byName = new Map(nodes.map(n => [n.bc.name, n]));
  const edges: LayoutEdge[] = [];
  const pairCount = new Map<string, number>();

  relationships.forEach((rel, index) => {
    const [a, b] = relEnds(rel).map(name => byName.get(name));
    if (!a || !b || a === b) return;

    // Parallel edges between the same pair fan out
    const key = [a.index, b.index].sort().join('-');
    const nth = pairCount.get(key) ?? 0;
    pairCount.set(key, nth + 1);

    const p0 = { x: a.x, y: a.y };
    const p2 = { x: b.x, y: b.y };
    const mid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
    const len = Math.hypot(p2.x - p0.x, p2.y - p0.y) || 1;
    const normal = { x: -(p2.y - p0.y) / len, y: (p2.x - p0.x) / len };

    let bend = 0;
    if (a.rank === b.rank && Math.abs(a.order - b.order) > 1) bend = 50 + 25 * Math.abs(a.order - b.order);
    else if (Math.abs(a.rank - b.rank) > 1) bend = 60;
    bend += nth * 36 * (nth % 2 === 0 ? 1 : -1);
    // Same-row arcs bow upwards
    if (a.rank === b.rank && normal.y > 0) bend = -bend;
    const c = { x: mid.x + normal.x * bend, y: mid.y + normal.y * bend };

    // Clip the curve at the node boundaries
    const steps = 48;
    const sampled: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const p = quad(p0, c, p2, i / steps);
      if (!inside(p, a) && !inside(p, b)) sampled.push(p);
    }
    if (sampled.length < 2) return;

    const edge: LayoutEdge = { rel, index, from: a, to: b, points: sampled };
    if (rel.type === 'UpstreamDownstream') {
      const up = ['U', ...(rel.upstreamPatterns ?? [])].join(' · ');
      const down = ['D', ...(rel.downstreamPatterns ?? [])].join(' · ');
      edge.fromBadge = { at: badgeAt(sampled, up, false), text: up };
      edge.toBadge = { at: badgeAt(sampled, down, true), text: down };
      if (rel.name) edge.label = { at: along(sampled, polylineLength(sampled) / 2).at, text: rel.name };
    } else {
      const text = rel.type === 'Partnership' ? 'Partnership' : 'Shared Kernel';
      edge.label = { at: along(sampled, polylineLength(sampled) / 2).at, text: rel.name ? `${text}: ${rel.name}` : text };
    }
    edges.push(edge);
  });

  return edges;
}

function pathData(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function badgeSvg(at: Point, text: string, cls: string): string {
  const w = badgeWidth(text);
  return `<g class="badge ${cls}" transform="translate(${at.x.toFixed(1)},${at.y.toFixed(1)})"><rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="11"/><text y="4.5" text-anchor="middle">${escapeHtml(text)}</text></g>`;
}

function describeRelationship(rel: ContextRelationship): string {
  switch (rel.type) {
    case 'Partnership':
      return 'Partnership';
    case 'SharedKernel':
      return 'Shared Kernel';
    default: {
      const up = rel.upstreamPatterns?.length ? ` [${rel.upstreamPatterns.join(', ')}]` : '';
      const down = rel.downstreamPatterns?.length ? ` [${rel.downstreamPatterns.join(', ')}]` : '';
      return `Upstream${up} → Downstream${down}`;
    }
  }
}

const CSS = `
.header h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
.header .meta { color: var(--ink-2); font-size: 14px; margin-top: 2px; }
.state { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .06em; padding: 2px 8px; border-radius: 999px; border: 1.5px solid var(--ink-2); color: var(--ink-2); vertical-align: middle; margin-left: 8px; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; margin-top: 16px; align-items: start; }
.panel { background: var(--surface); border: 1.5px solid var(--line-soft); border-radius: 8px; }
.map { padding: 8px; overflow: auto; }
.map svg { display: block; width: 100%; height: auto; max-height: 78vh; min-width: 0; }
.details { padding: 16px 18px; position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow: auto; }
.details h2 { margin: 0 0 4px; font-size: 20px; overflow-wrap: anywhere; }
.details h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); margin: 16px 0 6px; }
.details p { margin: 0; }
.details ul { margin: 0; padding-left: 18px; }
.details li { margin: 2px 0; }
.details .canvas-link { display: inline-block; margin-top: 12px; font-weight: 700; }
.tag { display: inline-block; font-size: 12px; padding: 1px 8px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); margin: 2px 4px 2px 0; }
.counts { color: var(--ink-3); font-size: 12px; }
svg text { font-family: inherit; fill: var(--ink); }
.node rect.box { fill: var(--surface); stroke: var(--line); stroke-width: 2; }
.node rect.stripe { fill: var(--surface-2); }
.node .name { font-weight: 700; font-size: 15px; }
.node .sub { font-size: 12px; fill: var(--ink-2); }
.node { cursor: pointer; outline: none; }
.node:focus-visible rect.box { stroke: var(--accent); stroke-width: 4; }
.node.selected rect.box { stroke: var(--accent); stroke-width: 3.5; }
.edge path { fill: none; stroke: var(--ink-2); stroke-width: 2; }
.edge.sym path { stroke-dasharray: 7 5; }
.badge rect { fill: var(--surface); stroke: var(--ink-2); stroke-width: 1.5; }
.badge.down rect { fill: var(--surface-2); }
.badge text { font-size: 12px; font-weight: 700; }
.label rect { fill: var(--bg); stroke: none; }
.label text { font-size: 12px; font-style: italic; fill: var(--ink-2); }
svg.focus .node:not(.hl), svg.focus .edge:not(.hl) { opacity: .22; }
svg .node, svg .edge { transition: opacity .15s; }
.edge.hl path { stroke: var(--accent); stroke-width: 3; }
.sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 16px; }
.sections .panel { padding: 14px 18px; }
.sections h2 { margin: 0 0 10px; font-size: 17px; }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line-soft); vertical-align: top; overflow-wrap: anywhere; }
.table-wrap { overflow-x: auto; }
th { font-size: 12px; color: var(--ink-3); font-weight: 700; }
dl.legend { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; font-size: 13.5px; }
dl.legend dt { font-weight: 700; }
dl.legend dd { margin: 0; color: var(--ink-2); }
.swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: baseline; }
.empty { padding: 40px; text-align: center; color: var(--ink-3); }
@media (max-width: 900px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .details { position: static; max-height: none; }
}
@media print {
  .layout { grid-template-columns: 1fr; }
  .details { display: none; }
}
`;

const SCRIPT = `
(function () {
  var data = JSON.parse(document.getElementById('cm-data').textContent);
  var svg = document.querySelector('.map svg');
  var panel = document.getElementById('details');
  if (!svg || !panel) return;
  var nodes = Array.prototype.slice.call(svg.querySelectorAll('.node'));
  var edges = Array.prototype.slice.call(svg.querySelectorAll('.edge'));
  var selected = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function focusOn(i) {
    if (i === null) { svg.classList.remove('focus'); nodes.concat(edges).forEach(function (el) { el.classList.remove('hl'); }); return; }
    svg.classList.add('focus');
    var keep = {}; keep[i] = true;
    edges.forEach(function (e) {
      var on = e.dataset.a === String(i) || e.dataset.b === String(i);
      e.classList.toggle('hl', on);
      if (on) { keep[e.dataset.a] = true; keep[e.dataset.b] = true; }
    });
    nodes.forEach(function (n) { n.classList.toggle('hl', !!keep[n.dataset.i]); });
  }

  function show(i) {
    selected = i;
    nodes.forEach(function (n) { n.classList.toggle('selected', n.dataset.i === String(i)); });
    focusOn(i);
    var c = data.contexts[i];
    var h = '<h2>' + esc(c.name) + '</h2>';
    if (c.tags.length) h += '<div>' + c.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>';
    h += '<h3>Purpose</h3>' + (c.purpose ? '<p>' + esc(c.purpose) + '</p>' : '<p class="muted">No domain vision statement.</p>');
    if (c.responsibilities.length) h += '<h3>Responsibilities</h3><ul>' + c.responsibilities.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';
    h += '<h3>Aggregates</h3>';
    h += c.aggregates.length ? '<ul>' + c.aggregates.map(function (a) { return '<li>' + esc(a.name) + ' <span class="counts">' + esc(a.counts) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">None.</p>';
    h += '<h3>Relationships</h3>';
    h += c.relationships.length ? '<ul>' + c.relationships.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '<p class="muted">None.</p>';
    if (c.canvas) h += '<a class="canvas-link" href="' + esc(c.canvas) + '">Open bounded context canvas &rarr;</a>';
    panel.innerHTML = h;
  }

  nodes.forEach(function (n) {
    var i = Number(n.dataset.i);
    n.addEventListener('mouseenter', function () { focusOn(i); });
    n.addEventListener('mouseleave', function () { focusOn(selected); });
    n.addEventListener('focus', function () { show(i); });
    n.addEventListener('click', function () { show(i); });
    n.addEventListener('dblclick', function () { var c = data.contexts[i]; if (c.canvas) location.href = c.canvas; });
    n.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && data.contexts[i].canvas) location.href = data.contexts[i].canvas;
    });
  });
  svg.addEventListener('click', function (ev) {
    if (ev.target === svg) { selected = null; nodes.forEach(function (n) { n.classList.remove('selected'); }); focusOn(null); panel.innerHTML = data.intro; }
  });
})();
`;

/** Render the model's context map as a full HTML page */
export function renderContextMapHtml(model: CMLModel, options: ContextMapHtmlOptions = {}): string {
  const contexts = contextsOnMap(model);
  const relationships = model.contextMap?.relationships ?? [];
  const nodes = layoutNodes(contexts, relationships);
  const edges = layoutEdges(nodes, relationships);
  const canvasHrefs = options.canvasHrefs ?? {};

  const domainOf = (bc: BoundedContext) => bc.canvas?.strategicClassification?.domain?.[0];
  const usedDomains = [...new Set(contexts.map(domainOf).filter((d): d is NonNullable<typeof d> => !!d))];

  // Bounds, including curve bulges and badges
  const pad = 40;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const nd of nodes) {
    xs.push(nd.x - nd.w / 2, nd.x + nd.w / 2);
    ys.push(nd.y - nd.h / 2, nd.y + nd.h / 2);
  }
  for (const e of edges) {
    for (const p of e.points) {
      xs.push(p.x);
      ys.push(p.y);
    }
    for (const b of [e.fromBadge, e.toBadge, e.label]) {
      if (b) {
        xs.push(b.at.x - badgeWidth(b.text) / 2, b.at.x + badgeWidth(b.text) / 2);
        ys.push(b.at.y - 12, b.at.y + 12);
      }
    }
  }
  const minX = Math.min(0, ...xs) - pad;
  const minY = Math.min(0, ...ys) - pad;
  const width = Math.max(...xs, 0) - minX + pad;
  const height = Math.max(...ys, 0) - minY + pad;

  const edgeSvg = edges
    .map(e => {
      const parts = [`<path d="${pathData(e.points)}"/>`];
      if (e.label) {
        const w = badgeWidth(e.label.text);
        parts.push(`<g class="label" transform="translate(${e.label.at.x.toFixed(1)},${e.label.at.y.toFixed(1)})"><rect x="${-w / 2}" y="-10" width="${w}" height="20" rx="4"/><text y="4" text-anchor="middle">${escapeHtml(e.label.text)}</text></g>`);
      }
      if (e.fromBadge) parts.push(badgeSvg(e.fromBadge.at, e.fromBadge.text, 'up'));
      if (e.toBadge) parts.push(badgeSvg(e.toBadge.at, e.toBadge.text, 'down'));
      const sym = e.rel.type === 'UpstreamDownstream' ? '' : ' sym';
      return `<g class="edge${sym}" data-a="${e.from.index}" data-b="${e.to.index}"><title>${escapeHtml(`${e.from.bc.name} – ${e.to.bc.name}: ${describeRelationship(e.rel)}`)}</title>${parts.join('')}</g>`;
    })
    .join('\n');

  const nodeSvg = nodes
    .map(nd => {
      const x = nd.x - nd.w / 2;
      const y = nd.y - nd.h / 2;
      const aggCount = nd.bc.aggregates.length + nd.bc.modules.reduce((s, m) => s + m.aggregates.length, 0);
      const sub = [nd.bc.implementationTechnology, `${aggCount} aggregate${aggCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
      const domain = domainOf(nd.bc);
      const stripe = domain
        ? `<rect class="stripe" x="${x + 2}" y="${y + 2}" width="8" height="${nd.h - 4}" rx="2" style="fill: var(--${domain})"/>`
        : '';
      return `<g class="node" data-i="${nd.index}" tabindex="0" role="button" aria-label="${escapeHtml(nd.bc.name)}"><title>${escapeHtml(nd.bc.domainVisionStatement ?? nd.bc.name)}</title><rect class="box" x="${x}" y="${y}" width="${nd.w}" height="${nd.h}" rx="10"/>${stripe}<text class="name" x="${nd.x}" y="${nd.y - 3}" text-anchor="middle">${escapeHtml(nd.bc.name)}</text><text class="sub" x="${nd.x}" y="${nd.y + 16}" text-anchor="middle">${escapeHtml(sub)}</text></g>`;
    })
    .join('\n');

  const svg =
    nodes.length > 0
      ? `<svg viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${width.toFixed(0)} ${height.toFixed(0)}" role="img" aria-label="Context map of ${escapeHtml(model.name)}">\n${edgeSvg}\n${nodeSvg}\n</svg>`
      : '<div class="empty">This model has no bounded contexts yet.</div>';

  // Data for the details panel
  const contextData = contexts.map(bc => {
    const canvas = bc.canvas;
    const tags = [
      ...(canvas?.strategicClassification?.domain ?? []).map(d => `${d} domain`),
      ...(canvas?.strategicClassification?.businessModel ?? []),
      ...(canvas?.strategicClassification?.evolution ?? []),
      ...(canvas?.domainRoles ?? []),
      ...(bc.implementationTechnology ? [bc.implementationTechnology] : []),
    ];
    const aggregates = [...bc.aggregates, ...bc.modules.flatMap(m => m.aggregates)].map(a => ({
      name: a.name,
      counts: [
        [a.entities.length, 'entities'],
        [a.valueObjects.length, 'value objects'],
        [a.commands.length, 'commands'],
        [a.domainEvents.length, 'events'],
      ]
        .filter(([count]) => (count as number) > 0)
        .map(([count, label]) => `${count} ${label}`)
        .join(', '),
    }));
    const rels = relationships
      .filter(r => relEnds(r).includes(bc.name))
      .map(r => {
        if (r.type === 'UpstreamDownstream') {
          const isUp = r.upstream === bc.name;
          const other = isUp ? r.downstream : r.upstream;
          const mine = isUp ? r.upstreamPatterns : r.downstreamPatterns;
          return `${isUp ? 'Upstream of' : 'Downstream of'} ${other}${mine?.length ? ` (${mine.join(', ')})` : ''}`;
        }
        const other = r.participant1 === bc.name ? r.participant2 : r.participant1;
        return `${r.type === 'Partnership' ? 'Partnership' : 'Shared Kernel'} with ${other}`;
      });
    return {
      name: bc.name,
      purpose: resolveCanvas(model, bc, false).purpose ?? bc.domainVisionStatement ?? '',
      tags,
      responsibilities: bc.responsibilities ?? [],
      aggregates,
      relationships: rels,
      canvas: canvasHrefs[bc.name] ?? null,
    };
  });

  const intro = `<h2>${escapeHtml(model.contextMap?.name ?? model.name)}</h2><p class="muted">Select a bounded context to see its purpose, aggregates and relationships.${
    Object.keys(canvasHrefs).length > 0 ? ' Double-click it, or press Enter, to open its canvas.' : ''
  }</p>`;

  const relRows = relationships
    .map(r => {
      const [a, b] = relEnds(r);
      return `<tr><td>${escapeHtml(a)}</td><td>${escapeHtml(describeRelationship(r))}</td><td>${escapeHtml(b)}</td><td>${escapeHtml(r.name ?? '')}${
        r.type === 'UpstreamDownstream' && r.exposedAggregates?.length ? `<div class="counts">exposes ${escapeHtml(r.exposedAggregates.join(', '))}</div>` : ''
      }</td></tr>`;
    })
    .join('');

  const contextRows = contexts
    .map(bc => {
      const href = canvasHrefs[bc.name];
      return `<tr><td>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(bc.name)}</a>` : escapeHtml(bc.name)}</td><td>${escapeHtml(bc.domainVisionStatement ?? '')}</td></tr>`;
    })
    .join('');

  const domainLegend = usedDomains
    .map(d => `<dt><span class="swatch" style="background: var(--${d})"></span>${escapeHtml(d)}</dt><dd>${escapeHtml(d)} domain (from the canvas classification)</dd>`)
    .join('');

  const stateBadge = model.contextMap?.state ? `<span class="state">${escapeHtml(model.contextMap.state.replace('_', '-'))}</span>` : '';

  const body = `<div class="page">
<header class="header">
  <h1>${escapeHtml(model.contextMap?.name ?? 'Context Map')}${stateBadge}</h1>
  <div class="meta">${escapeHtml(model.name)} · ${contexts.length} bounded context${contexts.length === 1 ? '' : 's'} · ${relationships.length} relationship${relationships.length === 1 ? '' : 's'}</div>
</header>
<div class="layout">
  <div class="panel map">${svg}</div>
  <aside class="panel details" id="details" aria-live="polite">${intro}</aside>
</div>
<div class="sections">
  <section class="panel">
    <h2>Relationships</h2>
    ${relationships.length > 0 ? `<div class="table-wrap"><table><thead><tr><th>Context</th><th>Relationship</th><th>Context</th><th>Notes</th></tr></thead><tbody>${relRows}</tbody></table></div>` : '<p class="muted">No relationships defined.</p>'}
  </section>
  <section class="panel">
    <h2>Bounded contexts</h2>
    ${contexts.length > 0 ? `<table><tbody>${contextRows}</tbody></table>` : '<p class="muted">None.</p>'}
  </section>
  <section class="panel">
    <h2>Legend</h2>
    <dl class="legend">
      <dt>U / D</dt><dd>Upstream / downstream end of a relationship</dd>
      <dt>OHS</dt><dd>Open Host Service</dd>
      <dt>PL</dt><dd>Published Language</dd>
      <dt>ACL</dt><dd>Anticorruption Layer</dd>
      <dt>CF</dt><dd>Conformist</dd>
      <dt>- - -</dt><dd>Symmetric relationship (Partnership, Shared Kernel)</dd>
      ${domainLegend}
    </dl>
  </section>
</div>
<footer class="page-footer">Generated by context-mapper-mcp from ${escapeHtml(model.name)}.</footer>
</div>
<script type="application/json" id="cm-data">${jsonForScript({ contexts: contextData, intro })}</script>`;

  return htmlPage({
    title: `${model.contextMap?.name ?? model.name} · Context Map`,
    description: `Context map of ${model.name}`,
    css: CSS,
    body,
    script: SCRIPT,
  });
}
