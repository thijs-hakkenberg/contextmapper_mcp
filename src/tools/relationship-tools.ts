/**
 * Relationship Tools - CRUD operations for Context Map relationships
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ContextRelationship,
  SymmetricRelationship,
  UpstreamDownstreamRelationship,
  UpstreamPattern,
  DownstreamPattern,
} from '../model/types.js';
import { getCurrentModel } from './model-tools.js';

// Tool: cml_create_relationship
export interface CreateRelationshipParams {
  type: 'Partnership' | 'SharedKernel' | 'UpstreamDownstream';
  // For symmetric relationships
  participant1?: string;
  participant2?: string;
  // For upstream-downstream relationships
  upstream?: string;
  downstream?: string;
  upstreamPatterns?: Array<'OHS' | 'PL'>;
  downstreamPatterns?: Array<'ACL' | 'CF'>;
  exposedAggregates?: string[];
  name?: string;
}

export interface CreateRelationshipResult {
  success: boolean;
  relationship?: {
    id: string;
    type: string;
  };
  error?: string;
}

export function createRelationship(params: CreateRelationshipParams): CreateRelationshipResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  if (!model.contextMap) {
    return { success: false, error: 'No context map exists. Create one first with cml_create_context_map' };
  }

  const bcNames = new Set(model.boundedContexts.map(bc => bc.name));

  if (params.type === 'Partnership' || params.type === 'SharedKernel') {
    // Symmetric relationship
    if (!params.participant1 || !params.participant2) {
      return { success: false, error: 'Symmetric relationships require participant1 and participant2' };
    }

    if (!bcNames.has(params.participant1)) {
      return { success: false, error: `Bounded context '${params.participant1}' not found` };
    }
    if (!bcNames.has(params.participant2)) {
      return { success: false, error: `Bounded context '${params.participant2}' not found` };
    }

    const rel: SymmetricRelationship = {
      id: uuidv4(),
      type: params.type,
      participant1: params.participant1,
      participant2: params.participant2,
      name: params.name,
    };

    model.contextMap.relationships.push(rel);

    return {
      success: true,
      relationship: {
        id: rel.id,
        type: rel.type,
      },
    };
  } else if (params.type === 'UpstreamDownstream') {
    // Upstream-downstream relationship
    if (!params.upstream || !params.downstream) {
      return { success: false, error: 'Upstream-downstream relationships require upstream and downstream context names' };
    }

    if (!bcNames.has(params.upstream)) {
      return { success: false, error: `Bounded context '${params.upstream}' not found` };
    }
    if (!bcNames.has(params.downstream)) {
      return { success: false, error: `Bounded context '${params.downstream}' not found` };
    }

    // Validate exposed aggregates if provided
    if (params.exposedAggregates) {
      const upstreamContext = model.boundedContexts.find(bc => bc.name === params.upstream);
      if (upstreamContext) {
        const aggNames = new Set(upstreamContext.aggregates.map(a => a.name));
        for (const aggName of params.exposedAggregates) {
          if (!aggNames.has(aggName)) {
            return { success: false, error: `Aggregate '${aggName}' not found in upstream context '${params.upstream}'` };
          }
        }
      }
    }

    const rel: UpstreamDownstreamRelationship = {
      id: uuidv4(),
      type: 'UpstreamDownstream',
      upstream: params.upstream,
      downstream: params.downstream,
      upstreamPatterns: params.upstreamPatterns as UpstreamPattern[],
      downstreamPatterns: params.downstreamPatterns as DownstreamPattern[],
      exposedAggregates: params.exposedAggregates,
      name: params.name,
    };

    model.contextMap.relationships.push(rel);

    return {
      success: true,
      relationship: {
        id: rel.id,
        type: 'UpstreamDownstream',
      },
    };
  }

  return { success: false, error: `Unknown relationship type: ${params.type}` };
}

// Tool: cml_update_relationship
export interface UpdateRelationshipParams {
  id: string;
  upstreamPatterns?: Array<'OHS' | 'PL'>;
  downstreamPatterns?: Array<'ACL' | 'CF'>;
  exposedAggregates?: string[];
  name?: string;
}

export interface UpdateRelationshipResult {
  success: boolean;
  relationship?: {
    id: string;
    type: string;
  };
  error?: string;
}

export function updateRelationship(params: UpdateRelationshipParams): UpdateRelationshipResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  if (!model.contextMap) {
    return { success: false, error: 'No context map exists' };
  }

  const rel = model.contextMap.relationships.find(r => r.id === params.id);
  if (!rel) {
    return { success: false, error: `Relationship with id '${params.id}' not found` };
  }

  if (params.name !== undefined) {
    rel.name = params.name;
  }

  if (rel.type === 'UpstreamDownstream') {
    const udRel = rel as UpstreamDownstreamRelationship;

    if (params.upstreamPatterns !== undefined) {
      udRel.upstreamPatterns = params.upstreamPatterns as UpstreamPattern[];
    }
    if (params.downstreamPatterns !== undefined) {
      udRel.downstreamPatterns = params.downstreamPatterns as DownstreamPattern[];
    }
    if (params.exposedAggregates !== undefined) {
      udRel.exposedAggregates = params.exposedAggregates;
    }
  }

  return {
    success: true,
    relationship: {
      id: rel.id,
      type: rel.type,
    },
  };
}

// Tool: cml_delete_relationship
export interface DeleteRelationshipParams {
  id: string;
}

export interface DeleteRelationshipResult {
  success: boolean;
  error?: string;
}

export function deleteRelationship(params: DeleteRelationshipParams): DeleteRelationshipResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  if (!model.contextMap) {
    return { success: false, error: 'No context map exists' };
  }

  const idx = model.contextMap.relationships.findIndex(r => r.id === params.id);
  if (idx === -1) {
    return { success: false, error: `Relationship with id '${params.id}' not found` };
  }

  model.contextMap.relationships.splice(idx, 1);

  return { success: true };
}

// Tool: cml_get_relationship
export interface GetRelationshipParams {
  id: string;
}

export interface GetRelationshipResult {
  success: boolean;
  relationship?: {
    id: string;
    type: string;
    name?: string;
    participant1?: string;
    participant2?: string;
    upstream?: string;
    downstream?: string;
    upstreamPatterns?: string[];
    downstreamPatterns?: string[];
    exposedAggregates?: string[];
  };
  error?: string;
}

export function getRelationship(params: GetRelationshipParams): GetRelationshipResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  if (!model.contextMap) {
    return { success: false, error: 'No context map exists' };
  }

  const rel = model.contextMap.relationships.find(r => r.id === params.id);
  if (!rel) {
    return { success: false, error: `Relationship with id '${params.id}' not found` };
  }

  if (rel.type === 'Partnership' || rel.type === 'SharedKernel') {
    const symRel = rel as SymmetricRelationship;
    return {
      success: true,
      relationship: {
        id: rel.id,
        type: rel.type,
        name: rel.name,
        participant1: symRel.participant1,
        participant2: symRel.participant2,
      },
    };
  } else {
    const udRel = rel as UpstreamDownstreamRelationship;
    return {
      success: true,
      relationship: {
        id: rel.id,
        type: 'UpstreamDownstream',
        name: rel.name,
        upstream: udRel.upstream,
        downstream: udRel.downstream,
        upstreamPatterns: udRel.upstreamPatterns,
        downstreamPatterns: udRel.downstreamPatterns,
        exposedAggregates: udRel.exposedAggregates,
      },
    };
  }
}
