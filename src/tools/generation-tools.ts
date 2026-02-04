/**
 * Generation Tools - PlantUML diagram generation and CLI-based generators
 */

import { getCurrentModel } from './model-tools.js';
import { generateContextMapDiagram, generateAggregateDiagram, generateFullModelDiagram } from '../generators/plantuml.js';
import { ContextMapImageGenerator } from '../generators/cli/context-map.js';
import { MDSLGenerator } from '../generators/cli/mdsl.js';
import { GenericFreemarkerGenerator, BundledTemplateGenerator } from '../generators/cli/generic.js';
import { getBundledTemplate } from '../generators/cli/config.js';
import type { GeneratorResult, GeneratorOutput } from '../generators/interfaces.js';

// ==========================================
// Existing PlantUML Tools
// ==========================================

// Tool: cml_generate_context_map_diagram
export interface GenerateContextMapDiagramParams {
  includeAggregates?: boolean;
}

export interface GenerateContextMapDiagramResult {
  success: boolean;
  plantuml?: string;
  error?: string;
}

export function generateContextMapDiagramTool(params: GenerateContextMapDiagramParams = {}): GenerateContextMapDiagramResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  try {
    const plantuml = generateContextMapDiagram(model, params.includeAggregates);
    return { success: true, plantuml };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error generating diagram' };
  }
}

// Tool: cml_generate_aggregate_diagram
export interface GenerateAggregateDiagramParams {
  contextName: string;
  aggregateName: string;
}

export interface GenerateAggregateDiagramResult {
  success: boolean;
  plantuml?: string;
  error?: string;
}

export function generateAggregateDiagramTool(params: GenerateAggregateDiagramParams): GenerateAggregateDiagramResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const bc = model.boundedContexts.find(c => c.name === params.contextName);
  if (!bc) {
    return { success: false, error: `Bounded context '${params.contextName}' not found` };
  }

  let aggregate = bc.aggregates.find(a => a.name === params.aggregateName);

  if (!aggregate) {
    for (const mod of bc.modules) {
      const found = mod.aggregates.find(a => a.name === params.aggregateName);
      if (found) {
        aggregate = found;
        break;
      }
    }
  }

  if (!aggregate) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  try {
    const plantuml = generateAggregateDiagram(aggregate);
    return { success: true, plantuml };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error generating diagram' };
  }
}

// Tool: cml_generate_full_diagram
export interface GenerateFullDiagramResult {
  success: boolean;
  plantuml?: string;
  error?: string;
}

export function generateFullDiagramTool(): GenerateFullDiagramResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  try {
    const plantuml = generateFullModelDiagram(model);
    return { success: true, plantuml };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error generating diagram' };
  }
}

// ==========================================
// CLI-based Generator Tools
// ==========================================

/**
 * Common result type for CLI generator tools
 */
export interface CLIGeneratorResult {
  success: boolean;
  outputs?: Array<{
    type: 'file' | 'content';
    path?: string;
    content?: string;
    format: string;
    description?: string;
  }>;
  warnings?: string[];
  error?: string;
  suggestion?: string;
}

/**
 * Convert GeneratorResult to CLIGeneratorResult
 */
function convertResult(result: GeneratorResult): CLIGeneratorResult {
  if (result.success) {
    return {
      success: true,
      outputs: result.outputs,
      warnings: result.warnings,
    };
  } else {
    return {
      success: false,
      error: result.error?.message,
      suggestion: result.error?.suggestion,
    };
  }
}

// ==========================================
// Tool: cml_generate_context_map_image
// ==========================================

export interface GenerateContextMapImageParams {
  format?: 'png' | 'svg';
  outputDir?: string;
  width?: number;
  height?: number;
  fixWidth?: boolean;
  fixHeight?: boolean;
  timeout?: number;
}

/**
 * Generate Context Map visualization (PNG/SVG) using the CLI
 */
export async function generateContextMapImageTool(
  params: GenerateContextMapImageParams = {}
): Promise<CLIGeneratorResult> {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  if (!model.contextMap) {
    return {
      success: false,
      error: 'No context map defined in the model',
      suggestion: 'Create a context map using cml_create_context_map first',
    };
  }

  const generator = new ContextMapImageGenerator();
  const result = await generator.generate(model, {
    format: params.format,
    outputDir: params.outputDir,
    width: params.width,
    height: params.height,
    fixWidth: params.fixWidth,
    fixHeight: params.fixHeight,
    timeout: params.timeout,
  });

  return convertResult(result);
}

// ==========================================
// Tool: cml_generate_mdsl
// ==========================================

export interface GenerateMDSLParams {
  outputDir?: string;
  timeout?: number;
}

/**
 * Generate MDSL microservice contracts from Context Map relationships
 */
export async function generateMDSLTool(
  params: GenerateMDSLParams = {}
): Promise<CLIGeneratorResult> {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const generator = new MDSLGenerator();
  const result = await generator.generate(model, {
    outputDir: params.outputDir,
    timeout: params.timeout,
  });

  return convertResult(result);
}

// ==========================================
// Tool: cml_generate_from_template
// ==========================================

export interface GenerateFromTemplateParams {
  templatePath: string;
  outputDir?: string;
  outputFileName?: string;
  timeout?: number;
}

/**
 * Generate output from a custom Freemarker template
 */
export async function generateFromTemplateTool(
  params: GenerateFromTemplateParams
): Promise<CLIGeneratorResult> {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  if (!params.templatePath) {
    return {
      success: false,
      error: 'templatePath is required',
      suggestion: 'Provide the path to a Freemarker (.ftl) template file',
    };
  }

  const generator = new GenericFreemarkerGenerator();
  const result = await generator.generate(model, {
    templatePath: params.templatePath,
    outputDir: params.outputDir,
    outputFileName: params.outputFileName,
    timeout: params.timeout,
  });

  return convertResult(result);
}

// ==========================================
// Tool: cml_generate_glossary
// ==========================================

export interface GenerateGlossaryParams {
  outputDir?: string;
  timeout?: number;
}

/**
 * Generate ubiquitous language glossary using bundled template
 */
export async function generateGlossaryTool(
  params: GenerateGlossaryParams = {}
): Promise<CLIGeneratorResult> {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const templateInfo = getBundledTemplate('glossary');
  if (!templateInfo) {
    return {
      success: false,
      error: 'Bundled glossary template not found',
      suggestion: 'Reinstall the package to restore bundled templates',
    };
  }

  const generator = new BundledTemplateGenerator(
    'glossary',
    'Generate ubiquitous language glossary',
    'glossary',
    'markdown'
  );

  const result = await generator.generate(model, {
    outputDir: params.outputDir,
    timeout: params.timeout,
  } as any);

  return convertResult(result);
}

// ==========================================
// Tool: cml_generate_jhipster_jdl
// ==========================================

export interface GenerateJHipsterJDLParams {
  type?: 'microservices' | 'monolith';
  outputDir?: string;
  timeout?: number;
}

/**
 * Generate JHipster JDL using bundled template
 */
export async function generateJHipsterJDLTool(
  params: GenerateJHipsterJDLParams = {}
): Promise<CLIGeneratorResult> {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const templateType = params.type === 'monolith' ? 'jhipster-monolith' : 'jhipster-microservices';
  const templateInfo = getBundledTemplate(templateType);

  if (!templateInfo) {
    return {
      success: false,
      error: `Bundled ${templateType} template not found`,
      suggestion: 'Reinstall the package to restore bundled templates',
    };
  }

  const generator = new BundledTemplateGenerator(
    templateType,
    `Generate JHipster JDL for ${params.type || 'microservices'} architecture`,
    templateType,
    'jdl'
  );

  const result = await generator.generate(model, {
    outputDir: params.outputDir,
    timeout: params.timeout,
  } as any);

  return convertResult(result);
}

// ==========================================
// Tool: cml_generate_full_report
// ==========================================

export interface GenerateFullReportParams {
  outputDir?: string;
  timeout?: number;
}

/**
 * Generate comprehensive domain documentation using bundled template
 */
export async function generateFullReportTool(
  params: GenerateFullReportParams = {}
): Promise<CLIGeneratorResult> {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const templateInfo = getBundledTemplate('full-report');
  if (!templateInfo) {
    return {
      success: false,
      error: 'Bundled full-report template not found',
      suggestion: 'Reinstall the package to restore bundled templates',
    };
  }

  const generator = new BundledTemplateGenerator(
    'full-report',
    'Generate comprehensive domain documentation',
    'full-report',
    'markdown'
  );

  const result = await generator.generate(model, {
    outputDir: params.outputDir,
    timeout: params.timeout,
  } as any);

  return convertResult(result);
}
