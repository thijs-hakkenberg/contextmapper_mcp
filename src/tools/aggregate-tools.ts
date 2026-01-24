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
import { sanitizeIdentifier, validateAttributes, isReservedDomainObjectName } from '../model/validation.js';

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

/**
 * Helper to check if a domain object name already exists in another bounded context.
 * This prevents ambiguous type references (e.g., multiple "AgentId" definitions).
 *
 * @param name - The proposed name for the new domain object
 * @param currentContext - The context where the object is being created (excluded from check)
 * @returns Object with isDuplicate flag and location if found, or null if unique
 */
function checkForDuplicateDomainObjectName(
  name: string,
  currentContext: string
): { isDuplicate: boolean; existingLocation?: string; suggestion?: string } {
  const model = getCurrentModel();
  if (!model) return { isDuplicate: false };

  for (const bc of model.boundedContexts) {
    // Skip the current context - duplicates within same context are handled elsewhere
    if (bc.name === currentContext) continue;

    const allAggregates = [
      ...bc.aggregates,
      ...bc.modules.flatMap(m => m.aggregates),
    ];

    for (const agg of allAggregates) {
      // Check Value Objects
      if (agg.valueObjects.some(vo => vo.name === name)) {
        return {
          isDuplicate: true,
          existingLocation: `${bc.name}.${agg.name}`,
          suggestion: `Use a unique prefixed name like '${currentContext.replace(/Platform$|Context$|Server$/g, '')}${name}' instead`,
        };
      }

      // Check Entities
      if (agg.entities.some(e => e.name === name)) {
        return {
          isDuplicate: true,
          existingLocation: `${bc.name}.${agg.name}`,
          suggestion: `Use a unique prefixed name like '${currentContext.replace(/Platform$|Context$|Server$/g, '')}${name}' instead`,
        };
      }

      // Check Domain Events
      if (agg.domainEvents.some(e => e.name === name)) {
        return {
          isDuplicate: true,
          existingLocation: `${bc.name}.${agg.name}`,
          suggestion: `Use a unique prefixed name like '${currentContext.replace(/Platform$|Context$|Server$/g, '')}${name}' instead`,
        };
      }

      // Check Commands
      if (agg.commands.some(c => c.name === name)) {
        return {
          isDuplicate: true,
          existingLocation: `${bc.name}.${agg.name}`,
          suggestion: `Use a unique prefixed name like '${currentContext.replace(/Platform$|Context$|Server$/g, '')}${name}' instead`,
        };
      }
    }
  }

  return { isDuplicate: false };
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

  // Check if name is a reserved keyword (cannot be escaped for domain object names)
  const reservedCheck = isReservedDomainObjectName(name);
  if (reservedCheck.isReserved) {
    return {
      success: false,
      error: `'${name}' is a reserved CML keyword and cannot be used as an Aggregate name. Try: ${reservedCheck.suggestion}`,
    };
  }

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

  // Check if name is a reserved keyword (cannot be escaped for domain object names)
  const reservedCheck = isReservedDomainObjectName(name);
  if (reservedCheck.isReserved) {
    return {
      success: false,
      error: `'${name}' is a reserved CML keyword and cannot be used as an Entity name. Try: ${reservedCheck.suggestion}`,
    };
  }

  // Check for duplicate within aggregate
  if (aggregate.entities.some(e => e.name === name)) {
    return { success: false, error: `Entity '${name}' already exists in aggregate '${params.aggregateName}'` };
  }

  // Check for duplicate across other bounded contexts (prevents ambiguous type references)
  const duplicateCheck = checkForDuplicateDomainObjectName(name, params.contextName);
  if (duplicateCheck.isDuplicate) {
    return {
      success: false,
      error: `Entity name '${name}' already exists in ${duplicateCheck.existingLocation}. ${duplicateCheck.suggestion}`,
    };
  }

  // Validate attribute types
  if (params.attributes && params.attributes.length > 0) {
    const attrValidation = validateAttributes(params.attributes, name);
    if (!attrValidation.valid) {
      return {
        success: false,
        error: attrValidation.errors.join('\n'),
      };
    }
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

  // Check if name is a reserved keyword (cannot be escaped for domain object names)
  const reservedCheck = isReservedDomainObjectName(name);
  if (reservedCheck.isReserved) {
    return {
      success: false,
      error: `'${name}' is a reserved CML keyword and cannot be used as a Value Object name. Try: ${reservedCheck.suggestion}`,
    };
  }

  // Check for duplicate within aggregate
  if (aggregate.valueObjects.some(vo => vo.name === name)) {
    return { success: false, error: `Value object '${name}' already exists in aggregate '${params.aggregateName}'` };
  }

  // Check for duplicate across other bounded contexts (prevents ambiguous type references)
  const duplicateCheck = checkForDuplicateDomainObjectName(name, params.contextName);
  if (duplicateCheck.isDuplicate) {
    return {
      success: false,
      error: `Value object name '${name}' already exists in ${duplicateCheck.existingLocation}. ${duplicateCheck.suggestion}`,
    };
  }

  // Validate attribute types
  if (params.attributes && params.attributes.length > 0) {
    const attrValidation = validateAttributes(params.attributes, name);
    if (!attrValidation.valid) {
      return {
        success: false,
        error: attrValidation.errors.join('\n'),
      };
    }
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

  // Check if Value Object already exists in this aggregate (return existing)
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

  // Check for duplicate across other bounded contexts (prevents ambiguous type references)
  const duplicateCheck = checkForDuplicateDomainObjectName(name, params.contextName);
  if (duplicateCheck.isDuplicate) {
    return {
      success: false,
      error: `Identifier name '${name}' already exists in ${duplicateCheck.existingLocation}. ${duplicateCheck.suggestion}`,
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

  // Check if name is a reserved keyword (cannot be escaped for domain object names)
  const reservedCheck = isReservedDomainObjectName(name);
  if (reservedCheck.isReserved) {
    return {
      success: false,
      error: `'${name}' is a reserved CML keyword and cannot be used as a Domain Event name. Try: ${reservedCheck.suggestion}`,
    };
  }

  // Check for duplicate within aggregate
  if (aggregate.domainEvents.some(e => e.name === name)) {
    return { success: false, error: `Domain event '${name}' already exists in aggregate '${params.aggregateName}'` };
  }

  // Check for duplicate across other bounded contexts (prevents ambiguous type references)
  const duplicateCheck = checkForDuplicateDomainObjectName(name, params.contextName);
  if (duplicateCheck.isDuplicate) {
    return {
      success: false,
      error: `Domain event name '${name}' already exists in ${duplicateCheck.existingLocation}. ${duplicateCheck.suggestion}`,
    };
  }

  // Validate attribute types
  if (params.attributes && params.attributes.length > 0) {
    const attrValidation = validateAttributes(params.attributes, name);
    if (!attrValidation.valid) {
      return {
        success: false,
        error: attrValidation.errors.join('\n'),
      };
    }
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

  // Check if name is a reserved keyword (cannot be escaped for domain object names)
  const reservedCheck = isReservedDomainObjectName(name);
  if (reservedCheck.isReserved) {
    return {
      success: false,
      error: `'${name}' is a reserved CML keyword and cannot be used as a Command name. Try: ${reservedCheck.suggestion}`,
    };
  }

  // Check for duplicate within aggregate
  if (aggregate.commands.some(c => c.name === name)) {
    return { success: false, error: `Command '${name}' already exists in aggregate '${params.aggregateName}'` };
  }

  // Check for duplicate across other bounded contexts (prevents ambiguous type references)
  const duplicateCheck = checkForDuplicateDomainObjectName(name, params.contextName);
  if (duplicateCheck.isDuplicate) {
    return {
      success: false,
      error: `Command name '${name}' already exists in ${duplicateCheck.existingLocation}. ${duplicateCheck.suggestion}`,
    };
  }

  // Validate attribute types
  if (params.attributes && params.attributes.length > 0) {
    const attrValidation = validateAttributes(params.attributes, name);
    if (!attrValidation.valid) {
      return {
        success: false,
        error: attrValidation.errors.join('\n'),
      };
    }
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

// Tool: cml_batch_add_elements
// Batch creation of multiple domain objects in a single call
export interface BatchAddElementsParams {
  contextName: string;
  aggregateName: string;
  failFast?: boolean; // Default true - stop on first error
  entities?: Array<{
    name: string;
    aggregateRoot?: boolean;
    attributes?: Array<{ name: string; type: string; key?: boolean; nullable?: boolean }>;
  }>;
  valueObjects?: Array<{
    name: string;
    attributes?: Array<{ name: string; type: string }>;
  }>;
  identifiers?: Array<{
    name: string; // Will be normalized to end with "Id"
  }>;
  domainEvents?: Array<{
    name: string;
    attributes?: Array<{ name: string; type: string }>;
  }>;
  commands?: Array<{
    name: string;
    attributes?: Array<{ name: string; type: string }>;
  }>;
  services?: Array<{
    name: string;
    operations?: Array<{
      name: string;
      returnType?: string;
      parameters?: Array<{ name: string; type: string }>;
    }>;
  }>;
}

export interface BatchAddElementsResult {
  success: boolean;
  created: {
    entities: Array<{ id: string; name: string; isAggregateRoot: boolean }>;
    valueObjects: Array<{ id: string; name: string }>;
    identifiers: Array<{ id: string; name: string; type: string }>;
    domainEvents: Array<{ id: string; name: string }>;
    commands: Array<{ id: string; name: string }>;
    services: Array<{ id: string; name: string }>;
  };
  errors?: Array<{ elementType: string; name: string; error: string }>;
}

interface ValidationItem {
  elementType: 'entity' | 'valueObject' | 'identifier' | 'domainEvent' | 'command' | 'service';
  name: string;
  error: string;
}

export function batchAddElements(params: BatchAddElementsParams): BatchAddElementsResult {
  const model = getCurrentModel();
  if (!model) {
    return {
      success: false,
      created: { entities: [], valueObjects: [], identifiers: [], domainEvents: [], commands: [], services: [] },
      errors: [{ elementType: 'model', name: '', error: 'No model is currently loaded' }],
    };
  }

  // Find the target aggregate
  const aggregateResult = findAggregate(params.contextName, params.aggregateName);
  if (!aggregateResult) {
    return {
      success: false,
      created: { entities: [], valueObjects: [], identifiers: [], domainEvents: [], commands: [], services: [] },
      errors: [{ elementType: 'aggregate', name: params.aggregateName, error: `Aggregate '${params.aggregateName}' not found in context '${params.contextName}'` }],
    };
  }

  const { aggregate } = aggregateResult;
  const failFast = params.failFast !== false; // Default to true
  const validationErrors: ValidationItem[] = [];

  // ============================================
  // PHASE 1: Validate ALL elements before mutations
  // ============================================

  // Track names we're about to create (for duplicate detection within batch)
  const batchNames = new Set<string>();

  // Validate identifiers
  const normalizedIdentifiers: Array<{ originalName: string; normalizedName: string }> = [];
  for (const identifier of params.identifiers || []) {
    let name = sanitizeIdentifier(identifier.name);
    if (!name.endsWith('Id')) {
      name = name + 'Id';
    }
    name = name.charAt(0).toUpperCase() + name.slice(1);

    // Check duplicate in batch
    if (batchNames.has(name)) {
      validationErrors.push({ elementType: 'identifier', name, error: `Duplicate name '${name}' within this batch` });
      if (failFast) break;
      continue;
    }

    // Check duplicate in aggregate (existing identifier returns success, so skip duplicate check for identifiers in aggregate)
    // But check cross-context duplicates
    const duplicateCheck = checkForDuplicateDomainObjectName(name, params.contextName);
    if (duplicateCheck.isDuplicate) {
      validationErrors.push({
        elementType: 'identifier',
        name,
        error: `Identifier name '${name}' already exists in ${duplicateCheck.existingLocation}. ${duplicateCheck.suggestion}`,
      });
      if (failFast) break;
      continue;
    }

    batchNames.add(name);
    normalizedIdentifiers.push({ originalName: identifier.name, normalizedName: name });
  }

  // Validate value objects
  if (validationErrors.length === 0 || !failFast) {
    for (const vo of params.valueObjects || []) {
      const name = sanitizeIdentifier(vo.name);

      // Check reserved keyword
      const reservedCheck = isReservedDomainObjectName(name);
      if (reservedCheck.isReserved) {
        validationErrors.push({
          elementType: 'valueObject',
          name,
          error: `'${name}' is a reserved CML keyword and cannot be used as a Value Object name. Try: ${reservedCheck.suggestion}`,
        });
        if (failFast) break;
        continue;
      }

      // Check duplicate in batch
      if (batchNames.has(name)) {
        validationErrors.push({ elementType: 'valueObject', name, error: `Duplicate name '${name}' within this batch` });
        if (failFast) break;
        continue;
      }

      // Check duplicate in aggregate
      if (aggregate.valueObjects.some(v => v.name === name)) {
        validationErrors.push({ elementType: 'valueObject', name, error: `Value object '${name}' already exists in aggregate '${params.aggregateName}'` });
        if (failFast) break;
        continue;
      }

      // Check cross-context duplicate
      const duplicateCheck = checkForDuplicateDomainObjectName(name, params.contextName);
      if (duplicateCheck.isDuplicate) {
        validationErrors.push({
          elementType: 'valueObject',
          name,
          error: `Value object name '${name}' already exists in ${duplicateCheck.existingLocation}. ${duplicateCheck.suggestion}`,
        });
        if (failFast) break;
        continue;
      }

      // Validate attributes
      if (vo.attributes && vo.attributes.length > 0) {
        const attrValidation = validateAttributes(vo.attributes, name);
        if (!attrValidation.valid) {
          validationErrors.push({ elementType: 'valueObject', name, error: attrValidation.errors.join('; ') });
          if (failFast) break;
          continue;
        }
      }

      batchNames.add(name);
    }
  }

  // Validate entities
  if (validationErrors.length === 0 || !failFast) {
    for (const entity of params.entities || []) {
      const name = sanitizeIdentifier(entity.name);

      // Check reserved keyword
      const reservedCheck = isReservedDomainObjectName(name);
      if (reservedCheck.isReserved) {
        validationErrors.push({
          elementType: 'entity',
          name,
          error: `'${name}' is a reserved CML keyword and cannot be used as an Entity name. Try: ${reservedCheck.suggestion}`,
        });
        if (failFast) break;
        continue;
      }

      // Check duplicate in batch
      if (batchNames.has(name)) {
        validationErrors.push({ elementType: 'entity', name, error: `Duplicate name '${name}' within this batch` });
        if (failFast) break;
        continue;
      }

      // Check duplicate in aggregate
      if (aggregate.entities.some(e => e.name === name)) {
        validationErrors.push({ elementType: 'entity', name, error: `Entity '${name}' already exists in aggregate '${params.aggregateName}'` });
        if (failFast) break;
        continue;
      }

      // Check cross-context duplicate
      const duplicateCheck = checkForDuplicateDomainObjectName(name, params.contextName);
      if (duplicateCheck.isDuplicate) {
        validationErrors.push({
          elementType: 'entity',
          name,
          error: `Entity name '${name}' already exists in ${duplicateCheck.existingLocation}. ${duplicateCheck.suggestion}`,
        });
        if (failFast) break;
        continue;
      }

      // Validate attributes
      if (entity.attributes && entity.attributes.length > 0) {
        const attrValidation = validateAttributes(entity.attributes, name);
        if (!attrValidation.valid) {
          validationErrors.push({ elementType: 'entity', name, error: attrValidation.errors.join('; ') });
          if (failFast) break;
          continue;
        }
      }

      batchNames.add(name);
    }
  }

  // Validate domain events
  if (validationErrors.length === 0 || !failFast) {
    for (const event of params.domainEvents || []) {
      const name = sanitizeIdentifier(event.name);

      // Check reserved keyword
      const reservedCheck = isReservedDomainObjectName(name);
      if (reservedCheck.isReserved) {
        validationErrors.push({
          elementType: 'domainEvent',
          name,
          error: `'${name}' is a reserved CML keyword and cannot be used as a Domain Event name. Try: ${reservedCheck.suggestion}`,
        });
        if (failFast) break;
        continue;
      }

      // Check duplicate in batch
      if (batchNames.has(name)) {
        validationErrors.push({ elementType: 'domainEvent', name, error: `Duplicate name '${name}' within this batch` });
        if (failFast) break;
        continue;
      }

      // Check duplicate in aggregate
      if (aggregate.domainEvents.some(e => e.name === name)) {
        validationErrors.push({ elementType: 'domainEvent', name, error: `Domain event '${name}' already exists in aggregate '${params.aggregateName}'` });
        if (failFast) break;
        continue;
      }

      // Check cross-context duplicate
      const duplicateCheck = checkForDuplicateDomainObjectName(name, params.contextName);
      if (duplicateCheck.isDuplicate) {
        validationErrors.push({
          elementType: 'domainEvent',
          name,
          error: `Domain event name '${name}' already exists in ${duplicateCheck.existingLocation}. ${duplicateCheck.suggestion}`,
        });
        if (failFast) break;
        continue;
      }

      // Validate attributes
      if (event.attributes && event.attributes.length > 0) {
        const attrValidation = validateAttributes(event.attributes, name);
        if (!attrValidation.valid) {
          validationErrors.push({ elementType: 'domainEvent', name, error: attrValidation.errors.join('; ') });
          if (failFast) break;
          continue;
        }
      }

      batchNames.add(name);
    }
  }

  // Validate commands
  if (validationErrors.length === 0 || !failFast) {
    for (const cmd of params.commands || []) {
      const name = sanitizeIdentifier(cmd.name);

      // Check reserved keyword
      const reservedCheck = isReservedDomainObjectName(name);
      if (reservedCheck.isReserved) {
        validationErrors.push({
          elementType: 'command',
          name,
          error: `'${name}' is a reserved CML keyword and cannot be used as a Command name. Try: ${reservedCheck.suggestion}`,
        });
        if (failFast) break;
        continue;
      }

      // Check duplicate in batch
      if (batchNames.has(name)) {
        validationErrors.push({ elementType: 'command', name, error: `Duplicate name '${name}' within this batch` });
        if (failFast) break;
        continue;
      }

      // Check duplicate in aggregate
      if (aggregate.commands.some(c => c.name === name)) {
        validationErrors.push({ elementType: 'command', name, error: `Command '${name}' already exists in aggregate '${params.aggregateName}'` });
        if (failFast) break;
        continue;
      }

      // Check cross-context duplicate
      const duplicateCheck = checkForDuplicateDomainObjectName(name, params.contextName);
      if (duplicateCheck.isDuplicate) {
        validationErrors.push({
          elementType: 'command',
          name,
          error: `Command name '${name}' already exists in ${duplicateCheck.existingLocation}. ${duplicateCheck.suggestion}`,
        });
        if (failFast) break;
        continue;
      }

      // Validate attributes
      if (cmd.attributes && cmd.attributes.length > 0) {
        const attrValidation = validateAttributes(cmd.attributes, name);
        if (!attrValidation.valid) {
          validationErrors.push({ elementType: 'command', name, error: attrValidation.errors.join('; ') });
          if (failFast) break;
          continue;
        }
      }

      batchNames.add(name);
    }
  }

  // Validate services (services don't have cross-context uniqueness requirements like other domain objects)
  if (validationErrors.length === 0 || !failFast) {
    for (const svc of params.services || []) {
      const name = sanitizeIdentifier(svc.name);

      // Check duplicate in aggregate
      if (aggregate.services.some(s => s.name === name)) {
        validationErrors.push({ elementType: 'service', name, error: `Service '${name}' already exists in aggregate '${params.aggregateName}'` });
        if (failFast) break;
        continue;
      }
    }
  }

  // If validation failed, return errors without making any changes
  if (validationErrors.length > 0) {
    return {
      success: false,
      created: { entities: [], valueObjects: [], identifiers: [], domainEvents: [], commands: [], services: [] },
      errors: validationErrors,
    };
  }

  // ============================================
  // PHASE 2: Create all elements (validation passed)
  // ============================================

  const created: BatchAddElementsResult['created'] = {
    entities: [],
    valueObjects: [],
    identifiers: [],
    domainEvents: [],
    commands: [],
    services: [],
  };

  // Create identifiers first (as they may be referenced by other elements)
  for (const { normalizedName } of normalizedIdentifiers) {
    // Check if it already exists (return existing)
    const existing = aggregate.valueObjects.find(vo => vo.name === normalizedName);
    if (existing) {
      created.identifiers.push({
        id: existing.id,
        name: existing.name,
        type: `- ${existing.name}`,
      });
      continue;
    }

    const vo: ValueObject = {
      id: uuidv4(),
      name: normalizedName,
      attributes: [{ name: 'value', type: 'String' }],
    };
    aggregate.valueObjects.push(vo);
    created.identifiers.push({
      id: vo.id,
      name: vo.name,
      type: `- ${vo.name}`,
    });
  }

  // Create value objects
  for (const voParams of params.valueObjects || []) {
    const name = sanitizeIdentifier(voParams.name);
    const vo: ValueObject = {
      id: uuidv4(),
      name,
      attributes: (voParams.attributes || []).map(a => ({
        name: a.name,
        type: a.type,
      })),
    };
    aggregate.valueObjects.push(vo);
    created.valueObjects.push({ id: vo.id, name: vo.name });
  }

  // Create entities
  for (const entityParams of params.entities || []) {
    const name = sanitizeIdentifier(entityParams.name);
    const entity: Entity = {
      id: uuidv4(),
      name,
      aggregateRoot: entityParams.aggregateRoot,
      attributes: (entityParams.attributes || []).map(a => ({
        name: a.name,
        type: a.type,
        key: a.key,
        nullable: a.nullable,
      })),
      operations: [],
    };
    aggregate.entities.push(entity);

    if (entityParams.aggregateRoot) {
      aggregate.aggregateRoot = entity;
    }

    created.entities.push({
      id: entity.id,
      name: entity.name,
      isAggregateRoot: !!entity.aggregateRoot,
    });
  }

  // Create domain events
  for (const eventParams of params.domainEvents || []) {
    const name = sanitizeIdentifier(eventParams.name);
    const event: DomainEvent = {
      id: uuidv4(),
      name,
      attributes: (eventParams.attributes || []).map(a => ({
        name: a.name,
        type: a.type,
      })),
    };
    aggregate.domainEvents.push(event);
    created.domainEvents.push({ id: event.id, name: event.name });
  }

  // Create commands
  for (const cmdParams of params.commands || []) {
    const name = sanitizeIdentifier(cmdParams.name);
    const cmd: Command = {
      id: uuidv4(),
      name,
      attributes: (cmdParams.attributes || []).map(a => ({
        name: a.name,
        type: a.type,
      })),
    };
    aggregate.commands.push(cmd);
    created.commands.push({ id: cmd.id, name: cmd.name });
  }

  // Create services
  for (const svcParams of params.services || []) {
    const name = sanitizeIdentifier(svcParams.name);
    const svc: DomainService = {
      id: uuidv4(),
      name,
      operations: (svcParams.operations || []).map(op => ({
        name: op.name,
        returnType: op.returnType,
        parameters: op.parameters || [],
      })),
    };
    aggregate.services.push(svc);
    created.services.push({ id: svc.id, name: svc.name });
  }

  return { success: true, created };
}
