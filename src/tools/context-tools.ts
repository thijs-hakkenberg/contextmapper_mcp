/**
 * Context Tools - CRUD operations for Bounded Contexts
 */

import { v4 as uuidv4 } from 'uuid';
import type { BoundedContext, KnowledgeLevel, ContextMap } from '../model/types.js';
import { getCurrentModel, setCurrentModel } from './model-tools.js';
import { sanitizeIdentifier } from '../model/validation.js';

// Tool: cml_create_bounded_context
export interface CreateBoundedContextParams {
  name: string;
  domainVisionStatement?: string;
  responsibilities?: string[];
  implementationTechnology?: string;
  knowledgeLevel?: 'META' | 'CONCRETE';
}

export interface CreateBoundedContextResult {
  success: boolean;
  context?: {
    id: string;
    name: string;
  };
  error?: string;
}

export function createBoundedContext(params: CreateBoundedContextParams): CreateBoundedContextResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const name = sanitizeIdentifier(params.name);

  // Check for duplicate name
  if (model.boundedContexts.some(bc => bc.name === name)) {
    return { success: false, error: `Bounded context '${name}' already exists` };
  }

  const bc: BoundedContext = {
    id: uuidv4(),
    name,
    domainVisionStatement: params.domainVisionStatement,
    responsibilities: params.responsibilities,
    implementationTechnology: params.implementationTechnology,
    knowledgeLevel: params.knowledgeLevel as KnowledgeLevel | undefined,
    aggregates: [],
    modules: [],
  };

  model.boundedContexts.push(bc);

  // Add to context map if exists
  if (model.contextMap) {
    model.contextMap.boundedContexts.push(name);
  }

  return {
    success: true,
    context: {
      id: bc.id,
      name: bc.name,
    },
  };
}

// Tool: cml_update_bounded_context
export interface UpdateBoundedContextParams {
  name: string;
  newName?: string;
  domainVisionStatement?: string;
  responsibilities?: string[];
  implementationTechnology?: string;
  knowledgeLevel?: 'META' | 'CONCRETE';
}

export interface UpdateBoundedContextResult {
  success: boolean;
  context?: {
    id: string;
    name: string;
  };
  error?: string;
}

export function updateBoundedContext(params: UpdateBoundedContextParams): UpdateBoundedContextResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const bc = model.boundedContexts.find(c => c.name === params.name);
  if (!bc) {
    return { success: false, error: `Bounded context '${params.name}' not found` };
  }

  // Update name if provided
  if (params.newName) {
    const newName = sanitizeIdentifier(params.newName);

    // Check for duplicate
    if (newName !== bc.name && model.boundedContexts.some(c => c.name === newName)) {
      return { success: false, error: `Bounded context '${newName}' already exists` };
    }

    const oldName = bc.name;

    // Update context map references
    if (model.contextMap) {
      const idx = model.contextMap.boundedContexts.indexOf(oldName);
      if (idx !== -1) {
        model.contextMap.boundedContexts[idx] = newName;
      }

      // Update relationship references
      for (const rel of model.contextMap.relationships) {
        if (rel.type === 'Partnership' || rel.type === 'SharedKernel') {
          const symRel = rel as any;
          if (symRel.participant1 === oldName) symRel.participant1 = newName;
          if (symRel.participant2 === oldName) symRel.participant2 = newName;
        } else {
          const udRel = rel as any;
          if (udRel.upstream === oldName) udRel.upstream = newName;
          if (udRel.downstream === oldName) udRel.downstream = newName;
        }
      }
    }

    bc.name = newName;
  }

  // Update other properties
  if (params.domainVisionStatement !== undefined) {
    bc.domainVisionStatement = params.domainVisionStatement || undefined;
  }
  if (params.responsibilities !== undefined) {
    bc.responsibilities = params.responsibilities.length > 0 ? params.responsibilities : undefined;
  }
  if (params.implementationTechnology !== undefined) {
    bc.implementationTechnology = params.implementationTechnology || undefined;
  }
  if (params.knowledgeLevel !== undefined) {
    bc.knowledgeLevel = params.knowledgeLevel as KnowledgeLevel | undefined;
  }

  return {
    success: true,
    context: {
      id: bc.id,
      name: bc.name,
    },
  };
}

// Tool: cml_delete_bounded_context
export interface DeleteBoundedContextParams {
  name: string;
}

export interface DeleteBoundedContextResult {
  success: boolean;
  deletedRelationships?: number;
  error?: string;
}

export function deleteBoundedContext(params: DeleteBoundedContextParams): DeleteBoundedContextResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const idx = model.boundedContexts.findIndex(bc => bc.name === params.name);
  if (idx === -1) {
    return { success: false, error: `Bounded context '${params.name}' not found` };
  }

  // Remove from bounded contexts
  model.boundedContexts.splice(idx, 1);

  let deletedRelationships = 0;

  // Remove from context map and relationships
  if (model.contextMap) {
    const cmIdx = model.contextMap.boundedContexts.indexOf(params.name);
    if (cmIdx !== -1) {
      model.contextMap.boundedContexts.splice(cmIdx, 1);
    }

    // Remove relationships involving this context
    const originalLength = model.contextMap.relationships.length;
    model.contextMap.relationships = model.contextMap.relationships.filter(rel => {
      if (rel.type === 'Partnership' || rel.type === 'SharedKernel') {
        const symRel = rel as any;
        return symRel.participant1 !== params.name && symRel.participant2 !== params.name;
      } else {
        const udRel = rel as any;
        return udRel.upstream !== params.name && udRel.downstream !== params.name;
      }
    });
    deletedRelationships = originalLength - model.contextMap.relationships.length;
  }

  return {
    success: true,
    deletedRelationships,
  };
}

// Tool: cml_create_context_map (helper to initialize context map)
export interface CreateContextMapParams {
  name?: string;
  state?: 'AS_IS' | 'TO_BE';
}

export interface CreateContextMapResult {
  success: boolean;
  contextMap?: {
    id: string;
    name: string;
    state?: string;
  };
  error?: string;
}

export function createContextMap(params: CreateContextMapParams = {}): CreateContextMapResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  if (model.contextMap) {
    return { success: false, error: 'Context map already exists in model' };
  }

  const contextMap: ContextMap = {
    id: uuidv4(),
    name: params.name || 'MainContextMap',
    boundedContexts: model.boundedContexts.map(bc => bc.name),
    relationships: [],
    state: params.state,
  };

  model.contextMap = contextMap;

  return {
    success: true,
    contextMap: {
      id: contextMap.id,
      name: contextMap.name,
      state: contextMap.state,
    },
  };
}
