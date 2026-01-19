/**
 * Aggregate Tools - CRUD operations for Aggregates, Entities, Value Objects, Events, Commands, Services
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Aggregate,
  Entity,
  ValueObject,
  DomainEvent,
  Command,
  DomainService,
  Attribute,
  ServiceOperation,
  KnowledgeLevel,
} from '../model/types.js';
import { getCurrentModel } from './model-tools.js';
import { sanitizeIdentifier } from '../model/validation.js';

// Helper to find aggregate in a bounded context
function findAggregate(contextName: string, aggregateName: string): { aggregate: Aggregate; contextIdx: number } | null {
  const model = getCurrentModel();
  if (!model) return null;

  const bcIdx = model.boundedContexts.findIndex(bc => bc.name === contextName);
  if (bcIdx === -1) return null;

  const bc = model.boundedContexts[bcIdx];
  const agg = bc.aggregates.find(a => a.name === aggregateName);
  if (agg) return { aggregate: agg, contextIdx: bcIdx };

  // Check modules
  for (const mod of bc.modules) {
    const modAgg = mod.aggregates.find(a => a.name === aggregateName);
    if (modAgg) return { aggregate: modAgg, contextIdx: bcIdx };
  }

  return null;
}

// Tool: cml_create_aggregate
export interface CreateAggregateParams {
  contextName: string;
  name: string;
  responsibilities?: string[];
  knowledgeLevel?: 'META' | 'CONCRETE';
}

export interface CreateAggregateResult {
  success: boolean;
  aggregate?: {
    id: string;
    name: string;
    contextName: string;
  };
  error?: string;
}

export function createAggregate(params: CreateAggregateParams): CreateAggregateResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const bc = model.boundedContexts.find(c => c.name === params.contextName);
  if (!bc) {
    return { success: false, error: `Bounded context '${params.contextName}' not found` };
  }

  const name = sanitizeIdentifier(params.name);

  // Check for duplicate name
  if (bc.aggregates.some(a => a.name === name)) {
    return { success: false, error: `Aggregate '${name}' already exists in context '${params.contextName}'` };
  }

  const agg: Aggregate = {
    id: uuidv4(),
    name,
    responsibilities: params.responsibilities,
    knowledgeLevel: params.knowledgeLevel as KnowledgeLevel | undefined,
    entities: [],
    valueObjects: [],
    domainEvents: [],
    commands: [],
    services: [],
  };

  bc.aggregates.push(agg);

  return {
    success: true,
    aggregate: {
      id: agg.id,
      name: agg.name,
      contextName: bc.name,
    },
  };
}

// Tool: cml_update_aggregate
export interface UpdateAggregateParams {
  contextName: string;
  aggregateName: string;
  newName?: string;
  responsibilities?: string[];
  knowledgeLevel?: 'META' | 'CONCRETE';
}

export interface UpdateAggregateResult {
  success: boolean;
  aggregate?: {
    id: string;
    name: string;
  };
  error?: string;
}

export function updateAggregate(params: UpdateAggregateParams): UpdateAggregateResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;

  if (params.newName) {
    aggregate.name = sanitizeIdentifier(params.newName);
  }
  if (params.responsibilities !== undefined) {
    aggregate.responsibilities = params.responsibilities.length > 0 ? params.responsibilities : undefined;
  }
  if (params.knowledgeLevel !== undefined) {
    aggregate.knowledgeLevel = params.knowledgeLevel as KnowledgeLevel | undefined;
  }

  return {
    success: true,
    aggregate: {
      id: aggregate.id,
      name: aggregate.name,
    },
  };
}

// Tool: cml_delete_aggregate
export interface DeleteAggregateParams {
  contextName: string;
  aggregateName: string;
}

export interface DeleteAggregateResult {
  success: boolean;
  error?: string;
}

export function deleteAggregate(params: DeleteAggregateParams): DeleteAggregateResult {
  const model = getCurrentModel();
  if (!model) {
    return { success: false, error: 'No model is currently loaded' };
  }

  const bc = model.boundedContexts.find(c => c.name === params.contextName);
  if (!bc) {
    return { success: false, error: `Bounded context '${params.contextName}' not found` };
  }

  const idx = bc.aggregates.findIndex(a => a.name === params.aggregateName);
  if (idx !== -1) {
    bc.aggregates.splice(idx, 1);
    return { success: true };
  }

  // Check modules
  for (const mod of bc.modules) {
    const modIdx = mod.aggregates.findIndex(a => a.name === params.aggregateName);
    if (modIdx !== -1) {
      mod.aggregates.splice(modIdx, 1);
      return { success: true };
    }
  }

  return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
}

// Tool: cml_add_entity
export interface AddEntityParams {
  contextName: string;
  aggregateName: string;
  name: string;
  aggregateRoot?: boolean;
  attributes?: Array<{ name: string; type: string; key?: boolean; nullable?: boolean }>;
}

export interface AddEntityResult {
  success: boolean;
  entity?: {
    id: string;
    name: string;
    isAggregateRoot: boolean;
  };
  error?: string;
}

export function addEntity(params: AddEntityParams): AddEntityResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;
  const name = sanitizeIdentifier(params.name);

  // Check for duplicate
  if (aggregate.entities.some(e => e.name === name)) {
    return { success: false, error: `Entity '${name}' already exists in aggregate '${params.aggregateName}'` };
  }

  const entity: Entity = {
    id: uuidv4(),
    name,
    aggregateRoot: params.aggregateRoot,
    attributes: (params.attributes || []).map(a => ({
      name: a.name,
      type: a.type,
      key: a.key,
      nullable: a.nullable,
    })),
    operations: [],
  };

  aggregate.entities.push(entity);

  // Set as aggregate root if specified
  if (params.aggregateRoot) {
    aggregate.aggregateRoot = entity;
  }

  return {
    success: true,
    entity: {
      id: entity.id,
      name: entity.name,
      isAggregateRoot: !!entity.aggregateRoot,
    },
  };
}

// Tool: cml_add_value_object
export interface AddValueObjectParams {
  contextName: string;
  aggregateName: string;
  name: string;
  attributes?: Array<{ name: string; type: string }>;
}

export interface AddValueObjectResult {
  success: boolean;
  valueObject?: {
    id: string;
    name: string;
  };
  error?: string;
}

export function addValueObject(params: AddValueObjectParams): AddValueObjectResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;
  const name = sanitizeIdentifier(params.name);

  // Check for duplicate
  if (aggregate.valueObjects.some(vo => vo.name === name)) {
    return { success: false, error: `Value object '${name}' already exists in aggregate '${params.aggregateName}'` };
  }

  const vo: ValueObject = {
    id: uuidv4(),
    name,
    attributes: (params.attributes || []).map(a => ({
      name: a.name,
      type: a.type,
    })),
  };

  aggregate.valueObjects.push(vo);

  return {
    success: true,
    valueObject: {
      id: vo.id,
      name: vo.name,
    },
  };
}

// Tool: cml_add_identifier
// Creates an ID Value Object following DDD best practices
export interface AddIdentifierParams {
  contextName: string;
  aggregateName: string;
  name: string; // e.g., "ExecutionId", "TaskId", "ModelId"
}

export interface AddIdentifierResult {
  success: boolean;
  identifier?: {
    id: string;
    name: string;
    type: string; // The type to use in attribute declarations
  };
  error?: string;
}

export function addIdentifier(params: AddIdentifierParams): AddIdentifierResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;

  // Ensure name ends with "Id" for consistency
  let name = sanitizeIdentifier(params.name);
  if (!name.endsWith('Id')) {
    name = name + 'Id';
  }

  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1);

  // Check if Value Object already exists
  const existing = aggregate.valueObjects.find(vo => vo.name === name);
  if (existing) {
    return {
      success: true,
      identifier: {
        id: existing.id,
        name: existing.name,
        type: `- ${existing.name}`, // Reference syntax
      },
    };
  }

  // Create the ID Value Object with a single 'value' attribute
  const vo: ValueObject = {
    id: uuidv4(),
    name,
    attributes: [
      { name: 'value', type: 'String' },
    ],
  };

  aggregate.valueObjects.push(vo);

  return {
    success: true,
    identifier: {
      id: vo.id,
      name: vo.name,
      type: `- ${vo.name}`, // Reference syntax for CML
    },
  };
}

// Tool: cml_add_domain_event
export interface AddDomainEventParams {
  contextName: string;
  aggregateName: string;
  name: string;
  attributes?: Array<{ name: string; type: string }>;
}

export interface AddDomainEventResult {
  success: boolean;
  domainEvent?: {
    id: string;
    name: string;
  };
  error?: string;
}

export function addDomainEvent(params: AddDomainEventParams): AddDomainEventResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;
  const name = sanitizeIdentifier(params.name);

  // Check for duplicate
  if (aggregate.domainEvents.some(e => e.name === name)) {
    return { success: false, error: `Domain event '${name}' already exists in aggregate '${params.aggregateName}'` };
  }

  const event: DomainEvent = {
    id: uuidv4(),
    name,
    attributes: (params.attributes || []).map(a => ({
      name: a.name,
      type: a.type,
    })),
  };

  aggregate.domainEvents.push(event);

  return {
    success: true,
    domainEvent: {
      id: event.id,
      name: event.name,
    },
  };
}

// Tool: cml_add_command
export interface AddCommandParams {
  contextName: string;
  aggregateName: string;
  name: string;
  attributes?: Array<{ name: string; type: string }>;
}

export interface AddCommandResult {
  success: boolean;
  command?: {
    id: string;
    name: string;
  };
  error?: string;
}

export function addCommand(params: AddCommandParams): AddCommandResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;
  const name = sanitizeIdentifier(params.name);

  // Check for duplicate
  if (aggregate.commands.some(c => c.name === name)) {
    return { success: false, error: `Command '${name}' already exists in aggregate '${params.aggregateName}'` };
  }

  const cmd: Command = {
    id: uuidv4(),
    name,
    attributes: (params.attributes || []).map(a => ({
      name: a.name,
      type: a.type,
    })),
  };

  aggregate.commands.push(cmd);

  return {
    success: true,
    command: {
      id: cmd.id,
      name: cmd.name,
    },
  };
}

// Tool: cml_add_service
export interface AddServiceParams {
  contextName: string;
  aggregateName: string;
  name: string;
  operations?: Array<{
    name: string;
    returnType?: string;
    parameters?: Array<{ name: string; type: string }>;
  }>;
}

export interface AddServiceResult {
  success: boolean;
  service?: {
    id: string;
    name: string;
  };
  error?: string;
}

export function addService(params: AddServiceParams): AddServiceResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;
  const name = sanitizeIdentifier(params.name);

  // Check for duplicate
  if (aggregate.services.some(s => s.name === name)) {
    return { success: false, error: `Service '${name}' already exists in aggregate '${params.aggregateName}'` };
  }

  const svc: DomainService = {
    id: uuidv4(),
    name,
    operations: (params.operations || []).map(op => ({
      name: op.name,
      returnType: op.returnType,
      parameters: op.parameters || [],
    })),
  };

  aggregate.services.push(svc);

  return {
    success: true,
    service: {
      id: svc.id,
      name: svc.name,
    },
  };
}

// Tool: cml_delete_entity
export interface DeleteEntityParams {
  contextName: string;
  aggregateName: string;
  entityName: string;
}

export interface DeleteEntityResult {
  success: boolean;
  error?: string;
}

export function deleteEntity(params: DeleteEntityParams): DeleteEntityResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;
  const idx = aggregate.entities.findIndex(e => e.name === params.entityName);

  if (idx === -1) {
    return { success: false, error: `Entity '${params.entityName}' not found in aggregate '${params.aggregateName}'` };
  }

  // Check if it's the aggregate root
  if (aggregate.aggregateRoot && aggregate.aggregateRoot.name === params.entityName) {
    aggregate.aggregateRoot = undefined;
  }

  aggregate.entities.splice(idx, 1);
  return { success: true };
}

// Tool: cml_delete_value_object
export interface DeleteValueObjectParams {
  contextName: string;
  aggregateName: string;
  valueObjectName: string;
}

export interface DeleteValueObjectResult {
  success: boolean;
  error?: string;
}

export function deleteValueObject(params: DeleteValueObjectParams): DeleteValueObjectResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;
  const idx = aggregate.valueObjects.findIndex(vo => vo.name === params.valueObjectName);

  if (idx === -1) {
    return { success: false, error: `Value object '${params.valueObjectName}' not found in aggregate '${params.aggregateName}'` };
  }

  aggregate.valueObjects.splice(idx, 1);
  return { success: true };
}

// Tool: cml_delete_domain_event
export interface DeleteDomainEventParams {
  contextName: string;
  aggregateName: string;
  eventName: string;
}

export interface DeleteDomainEventResult {
  success: boolean;
  error?: string;
}

export function deleteDomainEvent(params: DeleteDomainEventParams): DeleteDomainEventResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;
  const idx = aggregate.domainEvents.findIndex(e => e.name === params.eventName);

  if (idx === -1) {
    return { success: false, error: `Domain event '${params.eventName}' not found in aggregate '${params.aggregateName}'` };
  }

  aggregate.domainEvents.splice(idx, 1);
  return { success: true };
}

// Tool: cml_delete_command
export interface DeleteCommandParams {
  contextName: string;
  aggregateName: string;
  commandName: string;
}

export interface DeleteCommandResult {
  success: boolean;
  error?: string;
}

export function deleteCommand(params: DeleteCommandParams): DeleteCommandResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;
  const idx = aggregate.commands.findIndex(c => c.name === params.commandName);

  if (idx === -1) {
    return { success: false, error: `Command '${params.commandName}' not found in aggregate '${params.aggregateName}'` };
  }

  aggregate.commands.splice(idx, 1);
  return { success: true };
}

// Tool: cml_delete_service
export interface DeleteServiceParams {
  contextName: string;
  aggregateName: string;
  serviceName: string;
}

export interface DeleteServiceResult {
  success: boolean;
  error?: string;
}

export function deleteService(params: DeleteServiceParams): DeleteServiceResult {
  const result = findAggregate(params.contextName, params.aggregateName);
  if (!result) {
    return { success: false, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` };
  }

  const { aggregate } = result;
  const idx = aggregate.services.findIndex(s => s.name === params.serviceName);

  if (idx === -1) {
    return { success: false, error: `Service '${params.serviceName}' not found in aggregate '${params.aggregateName}'` };
  }

  aggregate.services.splice(idx, 1);
  return { success: true };
}
