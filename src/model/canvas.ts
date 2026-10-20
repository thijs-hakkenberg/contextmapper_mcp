/**
 * Bounded Context Canvas support
 *
 * Implements the Bounded Context Canvas v5 by the DDD Crew
 * (https://github.com/ddd-crew/bounded-context-canvas, CC BY-SA 4.0).
 *
 * Canvas sections that CML cannot express are stored on BoundedContext.canvas and
 * persisted in a sidecar file (<model>.canvas.yaml) that uses the DDD Crew's canonical
 * YAML format, one YAML document per bounded context. Sections CML can express
 * (purpose, communication, ubiquitous language) are derived from the model and merged
 * with what was set explicitly.
 */

import { parseAllDocuments, stringify } from 'yaml';
import type {
  CMLModel,
  BoundedContext,
  Aggregate,
  BoundedContextCanvas,
  CanvasCollaboration,
  CanvasMessage,
  CanvasTerm,
  CanvasStrategicClassification,
  UpstreamPattern,
  DownstreamPattern,
} from './types.js';

export const CANVAS_DOMAINS = ['core', 'supporting', 'generic', 'other'] as const;
export const CANVAS_BUSINESS_MODELS = ['revenue', 'engagement', 'compliance', 'cost reduction'] as const;
export const CANVAS_EVOLUTIONS = ['genesis', 'custom built', 'product', 'commodity'] as const;
export const CANVAS_COLLABORATOR_TYPES = ['bounded context', 'frontend', 'user interaction', 'external system', 'other'] as const;
export const CANVAS_MESSAGE_TYPES = ['command', 'query', 'event'] as const;

export const CANVAS_SCHEMA_URL =
  'https://raw.githubusercontent.com/ddd-crew/bounded-context-canvas/main/tools/yaml-version/bounded-context-canvas.schema.json';

const TEXT_LIST_FIELDS = ['domainRoles', 'businessDecisions', 'assumptions', 'verificationMetrics', 'openQuestions'] as const;

/** Canvas with every section resolved, ready for rendering or export */
export interface ResolvedCanvas extends BoundedContextCanvas {
  name: string;
}

// ==========================================
// Paths
// ==========================================

/** Sidecar path for a model file: /a/b/model.cml -> /a/b/model.canvas.yaml */
export function getCanvasSidecarPath(cmlPath: string): string {
  return cmlPath.replace(/\.cml$/i, '') + '.canvas.yaml';
}

// ==========================================
// Validation
// ==========================================

/** Validate canvas data, returning a list of human-readable problems (empty when valid) */
export function validateCanvas(canvas: BoundedContextCanvas, where = 'canvas'): string[] {
  const errors: string[] = [];

  const checkEnum = (values: readonly string[] | undefined, allowed: readonly string[], path: string) => {
    for (const v of values ?? []) {
      if (!allowed.includes(v)) {
        errors.push(`${where}.${path}: unknown value "${v}", expected one of [${allowed.join(', ')}]`);
      }
    }
  };

  const sc = canvas.strategicClassification;
  checkEnum(sc?.domain, CANVAS_DOMAINS, 'strategicClassification.domain');
  checkEnum(sc?.businessModel, CANVAS_BUSINESS_MODELS, 'strategicClassification.businessModel');
  checkEnum(sc?.evolution, CANVAS_EVOLUTIONS, 'strategicClassification.evolution');

  for (const dir of ['inboundCommunication', 'outboundCommunication'] as const) {
    (canvas[dir] ?? []).forEach((c, i) => {
      if (!c.collaborator || typeof c.collaborator !== 'string') {
        errors.push(`${where}.${dir}[${i}]: collaborator is required`);
      }
      if (c.type !== undefined) {
        checkEnum([c.type], CANVAS_COLLABORATOR_TYPES, `${dir}[${i}].type`);
      }
      (c.messages ?? []).forEach((m, j) => {
        if (!m.name) {
          errors.push(`${where}.${dir}[${i}].messages[${j}]: name is required`);
        }
        checkEnum([m.type], CANVAS_MESSAGE_TYPES, `${dir}[${i}].messages[${j}].type`);
      });
    });
  }

  (canvas.ubiquitousLanguage ?? []).forEach((t, i) => {
    if (!t.term) {
      errors.push(`${where}.ubiquitousLanguage[${i}]: term is required`);
    }
  });

  return errors;
}

// ==========================================
// Derivation from the CML model
// ==========================================

const UPSTREAM_PATTERN_NAMES: Record<UpstreamPattern, string> = {
  OHS: 'open host service',
  PL: 'published language',
};

const DOWNSTREAM_PATTERN_NAMES: Record<DownstreamPattern, string> = {
  ACL: 'anticorruption layer',
  CF: 'conformist',
};

function allAggregates(bc: BoundedContext): Aggregate[] {
  return [...bc.aggregates, ...bc.modules.flatMap(m => m.aggregates)];
}

/** Find or create the collaboration entry for a collaborator, so each collaborator appears once per direction */
function collaborationFor(list: CanvasCollaboration[], collaborator: string, relationship: string): CanvasCollaboration {
  let entry = list.find(c => c.collaborator === collaborator);
  if (!entry) {
    entry = { collaborator, type: 'bounded context', relationship, messages: [] };
    list.push(entry);
  } else if (entry.relationship && !entry.relationship.split('; ').includes(relationship)) {
    entry.relationship = `${entry.relationship}; ${relationship}`;
  }
  return entry;
}

function addMessages(entry: CanvasCollaboration, messages: CanvasMessage[]): void {
  entry.messages ??= [];
  for (const m of messages) {
    if (!entry.messages.some(e => e.type === m.type && e.name === m.name)) {
      entry.messages.push(m);
    }
  }
}

/**
 * Derive inbound/outbound communication from context map relationships.
 *
 * For an upstream/downstream relationship, the downstream receives the domain events of the
 * upstream's exposed aggregates (all aggregates when none are exposed). Commands are only
 * attributed to the downstream when the relationship exposes aggregates explicitly, since
 * exposing an aggregate is what offers its commands. Symmetric relationships appear in both
 * directions without messages.
 */
export function deriveCommunication(model: CMLModel, bc: BoundedContext): { inbound: CanvasCollaboration[]; outbound: CanvasCollaboration[] } {
  const inbound: CanvasCollaboration[] = [];
  const outbound: CanvasCollaboration[] = [];

  for (const rel of model.contextMap?.relationships ?? []) {
    if (rel.type !== 'UpstreamDownstream') {
      const other = rel.participant1 === bc.name ? rel.participant2 : rel.participant2 === bc.name ? rel.participant1 : null;
      if (!other) continue;
      const label = rel.type === 'Partnership' ? 'partnership' : 'shared kernel';
      collaborationFor(inbound, other, label);
      collaborationFor(outbound, other, label);
      continue;
    }

    const isUpstream = rel.upstream === bc.name;
    const isDownstream = rel.downstream === bc.name;
    if (!isUpstream && !isDownstream) continue;

    const upstreamBc = model.boundedContexts.find(c => c.name === rel.upstream);
    const exposed = rel.exposedAggregates ?? [];
    const aggregates = upstreamBc
      ? allAggregates(upstreamBc).filter(a => exposed.length === 0 || exposed.includes(a.name))
      : [];
    const commands: CanvasMessage[] =
      exposed.length > 0 ? aggregates.flatMap(a => a.commands.map(c => ({ type: 'command' as const, name: c.name }))) : [];
    const events: CanvasMessage[] = aggregates.flatMap(a => a.domainEvents.map(e => ({ type: 'event' as const, name: e.name })));

    // Describe the collaborator's role and patterns, then this context's own patterns
    const upstreamPatterns = (rel.upstreamPatterns ?? []).map(p => UPSTREAM_PATTERN_NAMES[p]);
    const downstreamPatterns = (rel.downstreamPatterns ?? []).map(p => DOWNSTREAM_PATTERN_NAMES[p]);
    const [role, theirs, ours] = isUpstream
      ? ['downstream', downstreamPatterns, upstreamPatterns]
      : ['upstream', upstreamPatterns, downstreamPatterns];
    let relationship = theirs.length > 0 ? `${role}: ${theirs.join(', ')}` : role;
    if (ours.length > 0) relationship += ` (this context: ${ours.join(', ')})`;

    if (isUpstream) {
      const other = rel.downstream;
      if (commands.length > 0) addMessages(collaborationFor(inbound, other, relationship), commands);
      if (events.length > 0 || commands.length === 0) addMessages(collaborationFor(outbound, other, relationship), events);
    } else {
      const other = rel.upstream;
      if (commands.length > 0) addMessages(collaborationFor(outbound, other, relationship), commands);
      if (events.length > 0 || commands.length === 0) addMessages(collaborationFor(inbound, other, relationship), events);
    }
  }

  return { inbound, outbound };
}

/** A value object holding only an identifier (e.g. OrderId) is not worth a glossary entry */
function isIdentifierObject(name: string, attributeCount: number): boolean {
  return /Id$/.test(name) && attributeCount <= 1;
}

/** Derive ubiquitous language terms from aggregates, entities and value objects */
export function deriveUbiquitousLanguage(bc: BoundedContext): CanvasTerm[] {
  const terms: CanvasTerm[] = [];
  const add = (term: string, definition?: string) => {
    const existing = terms.find(t => t.term === term);
    if (!existing) {
      terms.push(definition ? { term, definition } : { term });
    } else if (!existing.definition && definition) {
      existing.definition = definition;
    }
  };

  for (const agg of allAggregates(bc)) {
    add(agg.name, agg.documentation ?? (agg.responsibilities?.length ? agg.responsibilities.join('; ') : undefined));
    for (const e of agg.entities) {
      add(e.name, e.documentation);
    }
    for (const vo of agg.valueObjects) {
      if (!isIdentifierObject(vo.name, vo.attributes.length)) {
        add(vo.name, vo.documentation);
      }
    }
  }

  return terms;
}

/** Explicit entries win; derived entries are appended for collaborators/terms not set explicitly */
function mergeBy<T>(explicit: T[] | undefined, derived: T[], key: (item: T) => string): T[] {
  const result = [...(explicit ?? [])];
  const seen = new Set(result.map(i => key(i).toLowerCase()));
  for (const item of derived) {
    if (!seen.has(key(item).toLowerCase())) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Resolve the full canvas for a bounded context.
 * @param deriveFromModel when false, only explicitly set canvas data is returned
 */
export function resolveCanvas(model: CMLModel, bc: BoundedContext, deriveFromModel = true): ResolvedCanvas {
  const explicit = bc.canvas ?? {};
  const resolved: ResolvedCanvas = { name: bc.name, ...structuredClone(explicit) };

  if (!deriveFromModel) {
    return resolved;
  }

  resolved.purpose = explicit.purpose ?? bc.domainVisionStatement;

  const { inbound, outbound } = deriveCommunication(model, bc);
  resolved.inboundCommunication = mergeBy(resolved.inboundCommunication, inbound, c => c.collaborator);
  resolved.outboundCommunication = mergeBy(resolved.outboundCommunication, outbound, c => c.collaborator);
  resolved.ubiquitousLanguage = mergeBy(resolved.ubiquitousLanguage, deriveUbiquitousLanguage(bc), t => t.term);

  return resolved;
}

// ==========================================
// Canonical (DDD Crew YAML) format
// ==========================================

/** Single-valued lists are written as a scalar, like the DDD Crew examples */
function enumValue(values: string[] | undefined): string | string[] | undefined {
  if (!values || values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function nonEmpty<T>(list: T[] | undefined): T[] | undefined {
  return list && list.length > 0 ? list : undefined;
}

/** Convert a canvas to the DDD Crew canonical object (snake_case keys, empty sections omitted) */
export function toCanonicalCanvas(canvas: ResolvedCanvas): Record<string, unknown> {
  const out: Record<string, unknown> = { name: canvas.name };
  if (canvas.purpose) out.purpose = canvas.purpose;

  const sc = canvas.strategicClassification;
  if (sc) {
    const classification: Record<string, unknown> = {};
    const domain = enumValue(sc.domain);
    const businessModel = enumValue(sc.businessModel);
    const evolution = enumValue(sc.evolution);
    if (domain) classification.domain = domain;
    if (businessModel) classification.business_model = businessModel;
    if (evolution) classification.evolution = evolution;
    if (Object.keys(classification).length > 0) out.strategic_classification = classification;
  }

  if (nonEmpty(canvas.domainRoles)) out.domain_roles = canvas.domainRoles;

  for (const [key, list] of [
    ['inbound_communication', canvas.inboundCommunication],
    ['outbound_communication', canvas.outboundCommunication],
  ] as const) {
    if (nonEmpty(list)) {
      out[key] = list!.map(c => {
        const entry: Record<string, unknown> = { collaborator: c.collaborator };
        if (c.type) entry.type = c.type;
        if (c.relationship) entry.relationship = c.relationship;
        if (nonEmpty(c.messages)) entry.messages = c.messages!.map(m => ({ type: m.type, name: m.name }));
        return entry;
      });
    }
  }

  if (nonEmpty(canvas.ubiquitousLanguage)) {
    out.ubiquitous_language = canvas.ubiquitousLanguage!.map(t => (t.definition ? { term: t.term, definition: t.definition } : { term: t.term }));
  }
  if (nonEmpty(canvas.businessDecisions)) out.business_decisions = canvas.businessDecisions;
  if (nonEmpty(canvas.assumptions)) out.assumptions = canvas.assumptions;
  if (nonEmpty(canvas.verificationMetrics)) out.verification_metrics = canvas.verificationMetrics;
  if (nonEmpty(canvas.openQuestions)) out.open_questions = canvas.openQuestions;

  return out;
}

const CANONICAL_KEYS = [
  'name', 'purpose', 'strategic_classification', 'domain_roles', 'inbound_communication',
  'outbound_communication', 'ubiquitous_language', 'business_decisions', 'assumptions',
  'verification_metrics', 'open_questions',
];

function asList(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  return (Array.isArray(value) ? value : [value]).map(String);
}

function asCollaborations(value: unknown, path: string, errors: string[]): CanvasCollaboration[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected a list`);
    return undefined;
  }
  return value.map((c: any) => {
    const entry: CanvasCollaboration = { collaborator: String(c?.collaborator ?? '') };
    if (c?.type) entry.type = c.type;
    if (c?.relationship) entry.relationship = String(c.relationship);
    if (Array.isArray(c?.messages)) {
      entry.messages = c.messages.map((m: any) => ({ type: m?.type, name: String(m?.name ?? '') }));
    }
    return entry;
  });
}

/** Convert a DDD Crew canonical object into a name and canvas, collecting problems in errors */
export function fromCanonicalCanvas(obj: unknown, errors: string[], where = 'canvas'): { name: string; canvas: BoundedContextCanvas } | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push(`${where}: expected a mapping`);
    return null;
  }
  const data = obj as Record<string, any>;

  for (const key of Object.keys(data)) {
    if (!CANONICAL_KEYS.includes(key)) {
      errors.push(`${where}: unknown key "${key}", expected one of [${CANONICAL_KEYS.join(', ')}]`);
    }
  }
  if (!data.name || typeof data.name !== 'string') {
    errors.push(`${where}: name is required`);
    return null;
  }

  const canvas: BoundedContextCanvas = {};
  if (data.purpose) canvas.purpose = String(data.purpose);

  const sc = data.strategic_classification;
  if (sc && typeof sc === 'object') {
    const classification: CanvasStrategicClassification = {};
    const domain = asList(sc.domain);
    const businessModel = asList(sc.business_model);
    const evolution = asList(sc.evolution);
    if (domain) classification.domain = domain as CanvasStrategicClassification['domain'];
    if (businessModel) classification.businessModel = businessModel as CanvasStrategicClassification['businessModel'];
    if (evolution) classification.evolution = evolution as CanvasStrategicClassification['evolution'];
    canvas.strategicClassification = classification;
  }

  const inbound = asCollaborations(data.inbound_communication, `${where}.inbound_communication`, errors);
  const outbound = asCollaborations(data.outbound_communication, `${where}.outbound_communication`, errors);
  if (inbound) canvas.inboundCommunication = inbound;
  if (outbound) canvas.outboundCommunication = outbound;

  if (Array.isArray(data.ubiquitous_language)) {
    canvas.ubiquitousLanguage = data.ubiquitous_language.map((t: any) =>
      typeof t === 'string'
        ? { term: t }
        : t?.definition
          ? { term: String(t?.term ?? ''), definition: String(t.definition) }
          : { term: String(t?.term ?? '') }
    );
  }

  const textLists: Record<(typeof TEXT_LIST_FIELDS)[number], string> = {
    domainRoles: 'domain_roles',
    businessDecisions: 'business_decisions',
    assumptions: 'assumptions',
    verificationMetrics: 'verification_metrics',
    openQuestions: 'open_questions',
  };
  for (const field of TEXT_LIST_FIELDS) {
    const list = asList(data[textLists[field]]);
    if (list) canvas[field] = list;
  }

  errors.push(...validateCanvas(canvas, `${where} (${data.name})`));
  return { name: data.name, canvas };
}

/** Serialize one canvas as a standalone DDD Crew YAML file */
export function canvasToYaml(canvas: ResolvedCanvas): string {
  return `# yaml-language-server: $schema=${CANVAS_SCHEMA_URL}\n` + stringify(toCanonicalCanvas(canvas), { lineWidth: 0 });
}

/** True when a canvas holds no data */
export function isCanvasEmpty(canvas: BoundedContextCanvas | undefined): boolean {
  return !canvas || Object.keys(toCanonicalCanvas({ name: '_', ...canvas })).length <= 1;
}

/**
 * Serialize the explicitly set canvas data of all bounded contexts as a multi-document YAML sidecar.
 * Returns null when no context has canvas data.
 */
export function serializeCanvasSidecar(model: CMLModel): string | null {
  const docs = model.boundedContexts
    .filter(bc => !isCanvasEmpty(bc.canvas))
    .map(bc => stringify(toCanonicalCanvas({ name: bc.name, ...bc.canvas }), { lineWidth: 0 }));

  if (docs.length === 0) {
    return null;
  }

  return (
    `# Bounded Context Canvas data for ${model.name}, managed by context-mapper-mcp.\n` +
    `# One document per bounded context, in the DDD Crew canvas format:\n` +
    `# yaml-language-server: $schema=${CANVAS_SCHEMA_URL}\n` +
    docs.map(d => `---\n${d}`).join('')
  );
}

/** Parse a sidecar (or any single/multi-document canvas YAML) into canvases keyed by context name */
export function parseCanvasSidecar(text: string): { canvases: Map<string, BoundedContextCanvas>; errors: string[] } {
  const canvases = new Map<string, BoundedContextCanvas>();
  const errors: string[] = [];

  parseAllDocuments(text).forEach((doc, i) => {
    if ('errors' in doc && doc.errors.length > 0) {
      errors.push(...doc.errors.map(e => `document ${i + 1}: ${e.message}`));
      return;
    }
    const data = doc.toJS();
    if (data === null || data === undefined) return;
    const parsed = fromCanonicalCanvas(data, errors, `document ${i + 1}`);
    if (parsed) {
      canvases.set(parsed.name, parsed.canvas);
    }
  });

  return { canvases, errors };
}

/** Attach sidecar canvases to the model's bounded contexts, returning warnings for unknown contexts */
export function applyCanvasSidecar(model: CMLModel, canvases: Map<string, BoundedContextCanvas>): string[] {
  const warnings: string[] = [];
  for (const [name, canvas] of canvases) {
    const bc = model.boundedContexts.find(c => c.name === name);
    if (bc) {
      bc.canvas = canvas;
    } else {
      warnings.push(`Canvas for unknown bounded context '${name}' was ignored`);
    }
  }
  return warnings;
}
