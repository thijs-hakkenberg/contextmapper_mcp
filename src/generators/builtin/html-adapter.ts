/**
 * HTML Generators
 * Self-contained HTML pages for the context map and Bounded Context Canvases (no CLI required)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { CMLModel, BoundedContext } from '../../model/types.js';
import type { IGenerator, GeneratorResult, GeneratorOptions, GeneratorOutput } from '../interfaces.js';
import { createSuccessResult, createErrorResult } from '../interfaces.js';
import { getCLIConfig } from '../cli/config.js';
import { resolveCanvas, canvasToYaml } from '../../model/canvas.js';
import { renderCanvasHtml } from '../html/canvas-html.js';
import { renderContextMapHtml } from '../html/context-map-html.js';
import { canvasFileName } from '../html/common.js';

/**
 * Options for the Bounded Context Canvas generator
 */
export interface CanvasGeneratorOptions extends GeneratorOptions {
  /** Generate only this bounded context (default: all) */
  contextName?: string;
  /** Output format (default: html) */
  format?: 'html' | 'yaml';
  /** Fill purpose, communication and ubiquitous language from the CML model (default: true) */
  deriveFromModel?: boolean;
  /** Relative link from each canvas back to the context map page */
  contextMapHref?: string;
}

/**
 * Options for the HTML Context Map generator
 */
export interface ContextMapHtmlGeneratorOptions extends GeneratorOptions {
  /** Also write a canvas page per bounded context into <outputDir>/canvases and link them (default: true) */
  includeCanvases?: boolean;
  /** Fill canvas sections from the CML model (default: true) */
  deriveFromModel?: boolean;
}

/**
 * Bounded Context Canvas Generator
 * Writes one canvas per bounded context as HTML or as DDD Crew canonical YAML
 */
export class BoundedContextCanvasGenerator implements IGenerator {
  name = 'bounded-context-canvas';
  description = 'Generate Bounded Context Canvases (DDD Crew v5) as HTML pages or canonical YAML';
  requiresCLI = false;
  outputFormats = ['html', 'yaml'];

  async generate(model: CMLModel, options: CanvasGeneratorOptions = {}): Promise<GeneratorResult> {
    let contexts: BoundedContext[] = model.boundedContexts;
    if (options.contextName) {
      const bc = model.boundedContexts.find(c => c.name === options.contextName);
      if (!bc) {
        return createErrorResult('INTERNAL_ERROR', `Bounded context '${options.contextName}' not found`, 'Use cml_list_bounded_contexts to see available contexts');
      }
      contexts = [bc];
    }
    if (contexts.length === 0) {
      return createErrorResult('INTERNAL_ERROR', 'The model has no bounded contexts', 'Create bounded contexts with cml_create_bounded_context first');
    }

    try {
      const format = options.format ?? 'html';
      const outputDir = path.resolve(options.outputDir ?? getCLIConfig().outputDir);
      await fs.mkdir(outputDir, { recursive: true });

      const outputs: GeneratorOutput[] = [];
      for (const bc of contexts) {
        const canvas = resolveCanvas(model, bc, options.deriveFromModel ?? true);
        const content =
          format === 'yaml'
            ? canvasToYaml(canvas)
            : renderCanvasHtml(canvas, { contextMapHref: options.contextMapHref, modelName: model.name });
        const filePath = path.join(outputDir, canvasFileName(bc.name, format));
        await fs.writeFile(filePath, content, 'utf-8');
        outputs.push({ type: 'file', path: filePath, format, description: `Bounded Context Canvas for ${bc.name}` });
      }

      return createSuccessResult(outputs);
    } catch (error) {
      return createErrorResult('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error generating canvases');
    }
  }
}

/**
 * HTML Context Map Generator
 * Writes an interactive context map page, optionally linked to a canvas page per context
 */
export class HTMLContextMapGenerator implements IGenerator {
  name = 'html-context-map';
  description = 'Generate an interactive, self-contained HTML context map linked to Bounded Context Canvas pages';
  requiresCLI = false;
  outputFormats = ['html'];

  async generate(model: CMLModel, options: ContextMapHtmlGeneratorOptions = {}): Promise<GeneratorResult> {
    try {
      const outputDir = path.resolve(options.outputDir ?? getCLIConfig().outputDir);
      await fs.mkdir(outputDir, { recursive: true });

      const outputs: GeneratorOutput[] = [];
      const warnings: string[] = [];
      const canvasHrefs: Record<string, string> = {};

      if ((options.includeCanvases ?? true) && model.boundedContexts.length > 0) {
        const canvasResult = await new BoundedContextCanvasGenerator().generate(model, {
          outputDir: path.join(outputDir, 'canvases'),
          format: 'html',
          deriveFromModel: options.deriveFromModel,
          contextMapHref: '../context-map.html',
        });
        if (canvasResult.success) {
          for (const bc of model.boundedContexts) {
            canvasHrefs[bc.name] = `canvases/${canvasFileName(bc.name)}`;
          }
          outputs.push(...(canvasResult.outputs ?? []));
        } else {
          warnings.push(`Canvas pages were not generated: ${canvasResult.error?.message}`);
        }
      }

      if (!model.contextMap) {
        warnings.push('The model has no context map; all bounded contexts are shown without relationships');
      }

      const filePath = path.join(outputDir, 'context-map.html');
      await fs.writeFile(filePath, renderContextMapHtml(model, { canvasHrefs }), 'utf-8');
      outputs.unshift({ type: 'file', path: filePath, format: 'html', description: 'Interactive context map' });

      return createSuccessResult(outputs, warnings.length > 0 ? warnings : undefined);
    } catch (error) {
      return createErrorResult('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error generating HTML context map');
    }
  }
}

/**
 * Create all HTML generators
 */
export function createHTMLGenerators(): IGenerator[] {
  return [new HTMLContextMapGenerator(), new BoundedContextCanvasGenerator()];
}
