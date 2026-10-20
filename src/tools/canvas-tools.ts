/**
 * Canvas Tools - Bounded Context Canvas editing and HTML artifact generation
 */

import type { BoundedContextCanvas, CanvasCollaboration, CanvasTerm, CanvasStrategicClassification } from '../model/types.js';
import { getCurrentModel } from './model-tools.js';
import { validateCanvas, resolveCanvas, toCanonicalCanvas, canvasToYaml, isCanvasEmpty } from '../model/canvas.js';
import { BoundedContextCanvasGenerator, HTMLContextMapGenerator } from '../generators/builtin/html-adapter.js';
import type { CLIGeneratorResult } from './generation-tools.js';
import type { GeneratorResult } from '../generators/interfaces.js';

type OneOrMany<T> = T | T[] | null;

// Tool: cml_set_bounded_context_canvas
export interface SetBoundedContextCanvasParams {
  contextName: string;
  /** Remove all existing canvas data before applying the given sections */
  replace?: boolean;
  purpose?: string | null;
  strategicClassification?: {
    domain?: OneOrMany<string>;
    businessModel?: OneOrMany<string>;
    evolution?: OneOrMany<string>;
  } | null;
  domainRoles?: string[] | null;
  inboundCommunication?: CanvasCollaboration[] | null;
  outboundCommunication?: CanvasCollaboration[] | null;
  ubiquitousLanguage?: Array<CanvasTerm | string> | null;
  businessDecisions?: string[] | null;
  assumptions?: string[] | null;
  verificationMetrics?: string[] | null;
  openQuestions?: string[] | null;
}

export interface SetBoundedContextCanvasResult {
  success: boolean;
  canvas?: Record<string, unknown>;
  error?: string;
  errors?: string[];
}

function toList<T>(value: OneOrMany<T> | undefined): T[] | undefined {
  if (value === null || value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function emptyToUndefined<T>(list: T[] | null | undefined): T[] | undefined {
  return list && list.length > 0 ? list : undefined;
}

export function setBoundedContextCanvas(params: SetBoundedContextCanvasParams): SetBoundedContextCanvasResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const bc = model.boundedContexts.find(c => c.name === params.contextName);
  if (!bc) {
    return { success: false, error: `Bounded context '${params.contextName}' not found` };
  }

  // Work on a copy so invalid input leaves the model untouched
  const canvas: BoundedContextCanvas = params.replace ? {} : structuredClone(bc.canvas ?? {});

  // A section that is passed replaces the stored one; null or an empty list clears it
  if (params.purpose !== undefined) canvas.purpose = params.purpose || undefined;

  if (params.strategicClassification !== undefined) {
    if (params.strategicClassification === null) {
      canvas.strategicClassification = undefined;
    } else {
      const sc: CanvasStrategicClassification = { ...canvas.strategicClassification };
      const given = params.strategicClassification;
      if (given.domain !== undefined) sc.domain = emptyToUndefined(toList(given.domain)) as CanvasStrategicClassification['domain'];
      if (given.businessModel !== undefined) sc.businessModel = emptyToUndefined(toList(given.businessModel)) as CanvasStrategicClassification['businessModel'];
      if (given.evolution !== undefined) sc.evolution = emptyToUndefined(toList(given.evolution)) as CanvasStrategicClassification['evolution'];
      canvas.strategicClassification = sc.domain || sc.businessModel || sc.evolution ? sc : undefined;
    }
  }

  if (params.inboundCommunication !== undefined) canvas.inboundCommunication = emptyToUndefined(params.inboundCommunication);
  if (params.outboundCommunication !== undefined) canvas.outboundCommunication = emptyToUndefined(params.outboundCommunication);
  if (params.ubiquitousLanguage !== undefined) {
    canvas.ubiquitousLanguage = emptyToUndefined(params.ubiquitousLanguage?.map(t => (typeof t === 'string' ? { term: t } : t)));
  }

  for (const field of ['domainRoles', 'businessDecisions', 'assumptions', 'verificationMetrics', 'openQuestions'] as const) {
    if (params[field] !== undefined) canvas[field] = emptyToUndefined(params[field]);
  }

  const errors = validateCanvas(canvas, bc.name);
  if (errors.length > 0) {
    return { success: false, error: 'Invalid canvas data', errors };
  }

  bc.canvas = isCanvasEmpty(canvas) ? undefined : canvas;

  return {
    success: true,
    canvas: toCanonicalCanvas({ name: bc.name, ...bc.canvas }),
  };
}

// Tool: cml_get_bounded_context_canvas
export interface GetBoundedContextCanvasParams {
  contextName: string;
  format?: 'json' | 'yaml';
  deriveFromModel?: boolean;
}

export interface GetBoundedContextCanvasResult {
  success: boolean;
  canvas?: Record<string, unknown>;
  yaml?: string;
  error?: string;
}

export function getBoundedContextCanvas(params: GetBoundedContextCanvasParams): GetBoundedContextCanvasResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const bc = model.boundedContexts.find(c => c.name === params.contextName);
  if (!bc) {
    return { success: false, error: `Bounded context '${params.contextName}' not found` };
  }

  const canvas = resolveCanvas(model, bc, params.deriveFromModel ?? true);
  if (params.format === 'yaml') {
    return { success: true, yaml: canvasToYaml(canvas) };
  }
  return { success: true, canvas: toCanonicalCanvas(canvas) };
}

function convertResult(result: GeneratorResult): CLIGeneratorResult {
  return result.success
    ? { success: true, outputs: result.outputs, warnings: result.warnings }
    : { success: false, error: result.error?.message, suggestion: result.error?.suggestion };
}

// Tool: cml_generate_bounded_context_canvas
export interface GenerateBoundedContextCanvasParams {
  contextName?: string;
  format?: 'html' | 'yaml';
  outputDir?: string;
  deriveFromModel?: boolean;
}

export async function generateBoundedContextCanvasTool(params: GenerateBoundedContextCanvasParams = {}): Promise<CLIGeneratorResult> {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  return convertResult(await new BoundedContextCanvasGenerator().generate(model, { ...params }));
}

// Tool: cml_generate_context_map_html
export interface GenerateContextMapHtmlParams {
  outputDir?: string;
  includeCanvases?: boolean;
  deriveFromModel?: boolean;
}

export async function generateContextMapHtmlTool(params: GenerateContextMapHtmlParams = {}): Promise<CLIGeneratorResult> {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  return convertResult(await new HTMLContextMapGenerator().generate(model, { ...params }));
}
