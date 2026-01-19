/**
 * Model Tools - Create, load, save, validate CML models
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { CMLModel, ValidationResult } from '../model/types.js';
import { parseCML } from '../model/parser.js';
import { serializeCML } from '../model/writer.js';
import { validateModel } from '../model/validation.js';

// In-memory model store (for MCP session)
let currentModel: CMLModel | null = null;

export function getCurrentModel(): CMLModel | null {
  return currentModel;
}

export function setCurrentModel(model: CMLModel | null): void {
  currentModel = model;
}

// Tool: cml_create_model
export interface CreateModelParams {
  name: string;
}

export interface CreateModelResult {
  success: boolean;
  model?: {
    name: string;
    boundedContextsCount: number;
    hasContextMap: boolean;
  };
  error?: string;
}

export function createModel(params: CreateModelParams): CreateModelResult {
  try {
    const model: CMLModel = {
      name: params.name,
      boundedContexts: [],
    };

    currentModel = model;

    return {
      success: true,
      model: {
        name: model.name,
        boundedContextsCount: 0,
        hasContextMap: false,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error creating model',
    };
  }
}

// Tool: cml_load_model
export interface LoadModelParams {
  path: string;
}

export interface LoadModelResult {
  success: boolean;
  model?: {
    name: string;
    boundedContextsCount: number;
    hasContextMap: boolean;
    filePath: string;
  };
  parseErrors?: Array<{
    message: string;
    line?: number;
    column?: number;
  }>;
  error?: string;
}

export async function loadModel(params: LoadModelParams): Promise<LoadModelResult> {
  try {
    const resolvedPath = path.resolve(params.path);
    const content = await fs.readFile(resolvedPath, 'utf-8');

    const parseResult = parseCML(content);

    if (!parseResult.success || !parseResult.model) {
      return {
        success: false,
        parseErrors: parseResult.errors,
        error: 'Failed to parse CML file',
      };
    }

    const model = parseResult.model;
    model.filePath = resolvedPath;
    model.name = path.basename(resolvedPath, '.cml');

    currentModel = model;

    return {
      success: true,
      model: {
        name: model.name,
        boundedContextsCount: model.boundedContexts.length,
        hasContextMap: !!model.contextMap,
        filePath: resolvedPath,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error loading model',
    };
  }
}

// Tool: cml_save_model
export interface SaveModelParams {
  path?: string;
}

export interface SaveModelResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export async function saveModel(params: SaveModelParams): Promise<SaveModelResult> {
  try {
    if (!currentModel) {
      return {
        success: false,
        error: 'No model is currently loaded',
      };
    }

    const filePath = params.path
      ? path.resolve(params.path)
      : currentModel.filePath
        ? currentModel.filePath
        : null;

    if (!filePath) {
      return {
        success: false,
        error: 'No file path specified and model has no associated path',
      };
    }

    const content = serializeCML(currentModel);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, content, 'utf-8');

    currentModel.filePath = filePath;

    return {
      success: true,
      filePath,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error saving model',
    };
  }
}

// Tool: cml_validate_model
export interface ValidateModelResult {
  success: boolean;
  validation?: ValidationResult;
  error?: string;
}

export function validateCurrentModel(): ValidateModelResult {
  try {
    if (!currentModel) {
      return {
        success: false,
        error: 'No model is currently loaded',
      };
    }

    const validation = validateModel(currentModel);

    return {
      success: true,
      validation,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error validating model',
    };
  }
}

// Tool: cml_get_model_info
export interface ModelInfoResult {
  success: boolean;
  info?: {
    name: string;
    filePath?: string;
    hasContextMap: boolean;
    contextMapState?: string;
    boundedContextsCount: number;
    totalAggregates: number;
    totalEntities: number;
    totalValueObjects: number;
    totalDomainEvents: number;
    totalCommands: number;
    totalRelationships: number;
  };
  error?: string;
}

export function getModelInfo(): ModelInfoResult {
  try {
    if (!currentModel) {
      return {
        success: false,
        error: 'No model is currently loaded',
      };
    }

    let totalAggregates = 0;
    let totalEntities = 0;
    let totalValueObjects = 0;
    let totalDomainEvents = 0;
    let totalCommands = 0;

    for (const bc of currentModel.boundedContexts) {
      for (const agg of bc.aggregates) {
        totalAggregates++;
        totalEntities += agg.entities.length;
        totalValueObjects += agg.valueObjects.length;
        totalDomainEvents += agg.domainEvents.length;
        totalCommands += agg.commands.length;
      }
      for (const mod of bc.modules) {
        for (const agg of mod.aggregates) {
          totalAggregates++;
          totalEntities += agg.entities.length;
          totalValueObjects += agg.valueObjects.length;
          totalDomainEvents += agg.domainEvents.length;
          totalCommands += agg.commands.length;
        }
      }
    }

    return {
      success: true,
      info: {
        name: currentModel.name,
        filePath: currentModel.filePath,
        hasContextMap: !!currentModel.contextMap,
        contextMapState: currentModel.contextMap?.state,
        boundedContextsCount: currentModel.boundedContexts.length,
        totalAggregates,
        totalEntities,
        totalValueObjects,
        totalDomainEvents,
        totalCommands,
        totalRelationships: currentModel.contextMap?.relationships.length || 0,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error getting model info',
    };
  }
}
