/**
 * Generation Tools - PlantUML diagram generation
 */

import { getCurrentModel } from './model-tools.js';
import { generateContextMapDiagram, generateAggregateDiagram, generateFullModelDiagram } from '../generators/plantuml.js';

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
