/**
 * Query Tools - List, get, and search CML model elements
 */

import type {
  BoundedContext,
  Aggregate,
  Entity,
  ValueObject,
  DomainEvent,
  Command,
  DomainService,
  ContextRelationship,
  SymmetricRelationship,
  UpstreamDownstreamRelationship,
} from '../model/types.js';
import { getCurrentModel } from './model-tools.js';

// Tool: cml_list_bounded_contexts
export interface ListBoundedContextsResult {
  success: boolean;
  contexts?: Array<{
    id: string;
    name: string;
    aggregateCount: number;
    moduleCount: number;
    implementationTechnology?: string;
  }>;
  error?: string;
}

export function listBoundedContexts(): ListBoundedContextsResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  return {
    success: true,
    contexts: model.boundedContexts.map(bc => ({
      id: bc.id,
      name: bc.name,
      aggregateCount: bc.aggregates.length + bc.modules.reduce((sum, m) => sum + m.aggregates.length, 0),
      moduleCount: bc.modules.length,
      implementationTechnology: bc.implementationTechnology,
    })),
  };
}

// Tool: cml_get_bounded_context
export interface GetBoundedContextParams {
  name: string;
}

export interface GetBoundedContextResult {
  success: boolean;
  context?: {
    id: string;
    name: string;
    domainVisionStatement?: string;
    responsibilities?: string[];
    implementationTechnology?: string;
    knowledgeLevel?: string;
    aggregates: Array<{
      id: string;
      name: string;
      entityCount: number;
      valueObjectCount: number;
    }>;
    modules: Array<{
      id: string;
      name: string;
      aggregateCount: number;
    }>;
  };
  error?: string;
}

export function getBoundedContext(params: GetBoundedContextParams): GetBoundedContextResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const bc = model.boundedContexts.find(c => c.name === params.name);
  if (!bc) {
    return { success: false, error: `Bounded context '${params.name}' not found` };
  }

  return {
    success: true,
    context: {
      id: bc.id,
      name: bc.name,
      domainVisionStatement: bc.domainVisionStatement,
      responsibilities: bc.responsibilities,
      implementationTechnology: bc.implementationTechnology,
      knowledgeLevel: bc.knowledgeLevel,
      aggregates: bc.aggregates.map(agg => ({
        id: agg.id,
        name: agg.name,
        entityCount: agg.entities.length,
        valueObjectCount: agg.valueObjects.length,
      })),
      modules: bc.modules.map(mod => ({
        id: mod.id,
        name: mod.name,
        aggregateCount: mod.aggregates.length,
      })),
    },
  };
}

// Tool: cml_list_aggregates
export interface ListAggregatesParams {
  contextName?: string;
}

export interface ListAggregatesResult {
  success: boolean;
  aggregates?: Array<{
    id: string;
    name: string;
    contextName: string;
    moduleName?: string;
    entityCount: number;
    valueObjectCount: number;
    eventCount: number;
    commandCount: number;
  }>;
  error?: string;
}

export function listAggregates(params: ListAggregatesParams = {}): ListAggregatesResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const aggregates: ListAggregatesResult['aggregates'] = [];

  const contexts = params.contextName
    ? model.boundedContexts.filter(bc => bc.name === params.contextName)
    : model.boundedContexts;

  if (params.contextName && contexts.length === 0) {
    return { success: false, error: `Bounded context '${params.contextName}' not found` };
  }

  for (const bc of contexts) {
    for (const agg of bc.aggregates) {
      aggregates.push({
        id: agg.id,
        name: agg.name,
        contextName: bc.name,
        entityCount: agg.entities.length,
        valueObjectCount: agg.valueObjects.length,
        eventCount: agg.domainEvents.length,
        commandCount: agg.commands.length,
      });
    }
    for (const mod of bc.modules) {
      for (const agg of mod.aggregates) {
        aggregates.push({
          id: agg.id,
          name: agg.name,
          contextName: bc.name,
          moduleName: mod.name,
          entityCount: agg.entities.length,
          valueObjectCount: agg.valueObjects.length,
          eventCount: agg.domainEvents.length,
          commandCount: agg.commands.length,
        });
      }
    }
  }

  return { success: true, aggregates };
}

// Tool: cml_get_aggregate
export interface GetAggregateParams {
  contextName: string;
  aggregateName: string;
}

export interface GetAggregateResult {
  success: boolean;
  aggregate?: {
    id: string;
    name: string;
    contextName: string;
    moduleName?: string;
    responsibilities?: string[];
    knowledgeLevel?: string;
    aggregateRoot?: {
      id: string;
      name: string;
      attributes: Array<{ name: string; type: string; key?: boolean; nullable?: boolean }>;
    };
    entities: Array<{
      id: string;
      name: string;
      isAggregateRoot: boolean;
      attributes: Array<{ name: string; type: string; key?: boolean; nullable?: boolean }>;
    }>;
    valueObjects: Array<{
      id: string;
      name: string;
      attributes: Array<{ name: string; type: string }>;
    }>;
    domainEvents: Array<{
      id: string;
      name: string;
      attributes: Array<{ name: string; type: string }>;
    }>;
    commands: Array<{
      id: string;
      name: string;
      attributes: Array<{ name: string; type: string }>;
    }>;
    services: Array<{
      id: string;
      name: string;
      operations: Array<{
        name: string;
        returnType?: string;
        parameters: Array<{ name: string; type: string }>;
      }>;
    }>;
  };
  error?: string;
}

export function getAggregate(params: GetAggregateParams): GetAggregateResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const bc = model.boundedContexts.find(c => c.name === params.contextName);
  if (!bc) {
    return { success: false, error: `Bounded context '${params.contextName}' not found` };
  }

  let agg = bc.aggregates.find(a => a.name === params.aggregateName);
  let moduleName: string | undefined;

  if (!agg) {
    for (const mod of bc.modules) {
      const found = mod.aggregates.find(a => a.name === params.aggregateName);
      if (found) {
        agg = found;
        moduleName = mod.name;
        break;
      }
    }
  }

  if (!agg) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  return {
    success: true,
    aggregate: {
      id: agg.id,
      name: agg.name,
      contextName: bc.name,
      moduleName,
      responsibilities: agg.responsibilities,
      knowledgeLevel: agg.knowledgeLevel,
      aggregateRoot: agg.aggregateRoot ? {
        id: agg.aggregateRoot.id,
        name: agg.aggregateRoot.name,
        attributes: agg.aggregateRoot.attributes,
      } : undefined,
      entities: agg.entities.map(e => ({
        id: e.id,
        name: e.name,
        isAggregateRoot: !!e.aggregateRoot,
        attributes: e.attributes,
      })),
      valueObjects: agg.valueObjects.map(vo => ({
        id: vo.id,
        name: vo.name,
        attributes: vo.attributes,
      })),
      domainEvents: agg.domainEvents.map(ev => ({
        id: ev.id,
        name: ev.name,
        attributes: ev.attributes,
      })),
      commands: agg.commands.map(cmd => ({
        id: cmd.id,
        name: cmd.name,
        attributes: cmd.attributes,
      })),
      services: agg.services.map(svc => ({
        id: svc.id,
        name: svc.name,
        operations: svc.operations,
      })),
    },
  };
}

// Tool: cml_find_elements
export interface FindElementsParams {
  pattern: string;
  elementType?: 'BoundedContext' | 'Aggregate' | 'Entity' | 'ValueObject' | 'DomainEvent' | 'Command' | 'Service';
}

export interface FindElementsResult {
  success: boolean;
  elements?: Array<{
    type: string;
    id: string;
    name: string;
    contextName?: string;
    aggregateName?: string;
  }>;
  error?: string;
}

export function findElements(params: FindElementsParams): FindElementsResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const elements: FindElementsResult['elements'] = [];
  const regex = new RegExp(params.pattern, 'i');

  // Search bounded contexts
  if (!params.elementType || params.elementType === 'BoundedContext') {
    for (const bc of model.boundedContexts) {
      if (regex.test(bc.name)) {
        elements.push({
          type: 'BoundedContext',
          id: bc.id,
          name: bc.name,
        });
      }
    }
  }

  // Search aggregates
  for (const bc of model.boundedContexts) {
    const searchAggregates = (aggs: Aggregate[], modName?: string) => {
      for (const agg of aggs) {
        if (!params.elementType || params.elementType === 'Aggregate') {
          if (regex.test(agg.name)) {
            elements.push({
              type: 'Aggregate',
              id: agg.id,
              name: agg.name,
              contextName: bc.name,
            });
          }
        }

        // Search entities
        if (!params.elementType || params.elementType === 'Entity') {
          for (const entity of agg.entities) {
            if (regex.test(entity.name)) {
              elements.push({
                type: 'Entity',
                id: entity.id,
                name: entity.name,
                contextName: bc.name,
                aggregateName: agg.name,
              });
            }
          }
        }

        // Search value objects
        if (!params.elementType || params.elementType === 'ValueObject') {
          for (const vo of agg.valueObjects) {
            if (regex.test(vo.name)) {
              elements.push({
                type: 'ValueObject',
                id: vo.id,
                name: vo.name,
                contextName: bc.name,
                aggregateName: agg.name,
              });
            }
          }
        }

        // Search domain events
        if (!params.elementType || params.elementType === 'DomainEvent') {
          for (const event of agg.domainEvents) {
            if (regex.test(event.name)) {
              elements.push({
                type: 'DomainEvent',
                id: event.id,
                name: event.name,
                contextName: bc.name,
                aggregateName: agg.name,
              });
            }
          }
        }

        // Search commands
        if (!params.elementType || params.elementType === 'Command') {
          for (const cmd of agg.commands) {
            if (regex.test(cmd.name)) {
              elements.push({
                type: 'Command',
                id: cmd.id,
                name: cmd.name,
                contextName: bc.name,
                aggregateName: agg.name,
              });
            }
          }
        }

        // Search services
        if (!params.elementType || params.elementType === 'Service') {
          for (const svc of agg.services) {
            if (regex.test(svc.name)) {
              elements.push({
                type: 'Service',
                id: svc.id,
                name: svc.name,
                contextName: bc.name,
                aggregateName: agg.name,
              });
            }
          }
        }
      }
    };

    searchAggregates(bc.aggregates);
    for (const mod of bc.modules) {
      searchAggregates(mod.aggregates, mod.name);
    }
  }

  return { success: true, elements };
}

// Tool: cml_list_relationships
export interface ListRelationshipsParams {
  contextName?: string;
}

export interface ListRelationshipsResult {
  success: boolean;
  relationships?: Array<{
    id: string;
    type: string;
    participant1?: string;
    participant2?: string;
    upstream?: string;
    downstream?: string;
    upstreamPatterns?: string[];
    downstreamPatterns?: string[];
    exposedAggregates?: string[];
  }>;
  error?: string;
}

export function listRelationships(params: ListRelationshipsParams = {}): ListRelationshipsResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  if (!model.contextMap) {
    return { success: true, relationships: [] };
  }

  let relationships = model.contextMap.relationships;

  // Filter by context name if provided
  if (params.contextName) {
    relationships = relationships.filter(rel => {
      if (rel.type === 'Partnership' || rel.type === 'SharedKernel') {
        const symRel = rel as SymmetricRelationship;
        return symRel.participant1 === params.contextName || symRel.participant2 === params.contextName;
      } else {
        const udRel = rel as UpstreamDownstreamRelationship;
        return udRel.upstream === params.contextName || udRel.downstream === params.contextName;
      }
    });
  }

  return {
    success: true,
    relationships: relationships.map(rel => {
      if (rel.type === 'Partnership' || rel.type === 'SharedKernel') {
        const symRel = rel as SymmetricRelationship;
        return {
          id: rel.id,
          type: rel.type,
          participant1: symRel.participant1,
          participant2: symRel.participant2,
        };
      } else {
        const udRel = rel as UpstreamDownstreamRelationship;
        return {
          id: rel.id,
          type: 'UpstreamDownstream',
          upstream: udRel.upstream,
          downstream: udRel.downstream,
          upstreamPatterns: udRel.upstreamPatterns,
          downstreamPatterns: udRel.downstreamPatterns,
          exposedAggregates: udRel.exposedAggregates,
        };
      }
    }),
  };
}
