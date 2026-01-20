/**
 * CML Validation Rules
 */

import type {
  CMLModel,
  BoundedContext,
  Aggregate,
  ContextRelationship,
  ValidationResult,
  ValidationError,
  SymmetricRelationship,
  UpstreamDownstreamRelationship,
} from './types.js';

export function validateModel(model: CMLModel): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate context map
  if (model.contextMap) {
    validateContextMap(model, errors);
  }

  // Validate bounded contexts
  for (const bc of model.boundedContexts) {
    validateBoundedContext(bc, errors);
  }

  // Check for duplicate bounded context names
  const bcNames = new Set<string>();
  for (const bc of model.boundedContexts) {
    if (bcNames.has(bc.name)) {
      errors.push({
        type: 'error',
        message: `Duplicate bounded context name: ${bc.name}`,
        location: { element: bc.name },
      });
    }
    bcNames.add(bc.name);
  }

  // Check for duplicate domain object names across bounded contexts
  // This prevents ambiguous type references (e.g., multiple "AgentId" definitions)
  validateNoDuplicateDomainObjectNames(model, errors);

  return {
    valid: errors.filter(e => e.type === 'error').length === 0,
    errors,
  };
}

/**
 * Validates that domain object names (Value Objects, Entities, Domain Events, Commands)
 * are unique across all bounded contexts to prevent ambiguous type references.
 *
 * Example of what this prevents:
 * - A2AServer has "AgentId" Value Object
 * - DatabricksPlatform has "AgentId" Value Object
 * - This causes "The reference to the type 'AgentId' is ambiguous" error in CML tools
 *
 * Solution: Use unique prefixed names like "A2AAgentId" and "DatabricksAgentId"
 */
function validateNoDuplicateDomainObjectNames(model: CMLModel, errors: ValidationError[]): void {
  // Track all domain object names and their locations
  const domainObjectLocations = new Map<string, string[]>();

  for (const bc of model.boundedContexts) {
    const allAggregates = [
      ...bc.aggregates,
      ...bc.modules.flatMap(m => m.aggregates),
    ];

    for (const agg of allAggregates) {
      // Check Value Objects (most common source of duplicates like "AgentId")
      for (const vo of agg.valueObjects) {
        const locations = domainObjectLocations.get(vo.name) || [];
        locations.push(`${bc.name}.${agg.name}`);
        domainObjectLocations.set(vo.name, locations);
      }

      // Check Entities
      for (const entity of agg.entities) {
        const locations = domainObjectLocations.get(entity.name) || [];
        locations.push(`${bc.name}.${agg.name}`);
        domainObjectLocations.set(entity.name, locations);
      }

      // Check Domain Events
      for (const event of agg.domainEvents) {
        const locations = domainObjectLocations.get(event.name) || [];
        locations.push(`${bc.name}.${agg.name}`);
        domainObjectLocations.set(event.name, locations);
      }

      // Check Commands
      for (const cmd of agg.commands) {
        const locations = domainObjectLocations.get(cmd.name) || [];
        locations.push(`${bc.name}.${agg.name}`);
        domainObjectLocations.set(cmd.name, locations);
      }
    }
  }

  // Report errors for any duplicate names
  for (const [name, locations] of domainObjectLocations.entries()) {
    if (locations.length > 1) {
      errors.push({
        type: 'error',
        message: `Ambiguous domain object name '${name}' defined in multiple locations: ${locations.join(', ')}. Use unique prefixed names (e.g., 'A2A${name}', 'Databricks${name}') to avoid ambiguous type references.`,
        location: { element: name },
      });
    }
  }
}

function validateContextMap(model: CMLModel, errors: ValidationError[]): void {
  const contextMap = model.contextMap!;
  const bcNames = new Set(model.boundedContexts.map(bc => bc.name));

  // Check that all referenced contexts exist
  for (const ctxName of contextMap.boundedContexts) {
    if (!bcNames.has(ctxName)) {
      errors.push({
        type: 'error',
        message: `Context map references non-existent bounded context: ${ctxName}`,
        location: { element: ctxName },
      });
    }
  }

  // Validate relationships
  for (const rel of contextMap.relationships) {
    validateRelationship(rel, bcNames, errors);
  }
}

function validateRelationship(
  rel: ContextRelationship,
  bcNames: Set<string>,
  errors: ValidationError[]
): void {
  if (rel.type === 'Partnership' || rel.type === 'SharedKernel') {
    const symRel = rel as SymmetricRelationship;

    if (!bcNames.has(symRel.participant1)) {
      errors.push({
        type: 'error',
        message: `Relationship references non-existent bounded context: ${symRel.participant1}`,
        location: { element: rel.id },
      });
    }

    if (!bcNames.has(symRel.participant2)) {
      errors.push({
        type: 'error',
        message: `Relationship references non-existent bounded context: ${symRel.participant2}`,
        location: { element: rel.id },
      });
    }

    if (symRel.participant1 === symRel.participant2) {
      errors.push({
        type: 'warning',
        message: `Symmetric relationship between same context: ${symRel.participant1}`,
        location: { element: rel.id },
      });
    }
  } else if (rel.type === 'UpstreamDownstream') {
    const udRel = rel as UpstreamDownstreamRelationship;

    if (!bcNames.has(udRel.upstream)) {
      errors.push({
        type: 'error',
        message: `Relationship references non-existent upstream context: ${udRel.upstream}`,
        location: { element: rel.id },
      });
    }

    if (!bcNames.has(udRel.downstream)) {
      errors.push({
        type: 'error',
        message: `Relationship references non-existent downstream context: ${udRel.downstream}`,
        location: { element: rel.id },
      });
    }

    if (udRel.upstream === udRel.downstream) {
      errors.push({
        type: 'error',
        message: `Upstream-downstream relationship cannot be between same context: ${udRel.upstream}`,
        location: { element: rel.id },
      });
    }
  }
}

function validateBoundedContext(bc: BoundedContext, errors: ValidationError[]): void {
  // Check for empty bounded context
  if (bc.aggregates.length === 0 && bc.modules.length === 0) {
    errors.push({
      type: 'warning',
      message: `Bounded context '${bc.name}' has no aggregates or modules`,
      location: { element: bc.name },
    });
  }

  // Check for duplicate aggregate names within context
  const aggNames = new Set<string>();
  for (const agg of bc.aggregates) {
    if (aggNames.has(agg.name)) {
      errors.push({
        type: 'error',
        message: `Duplicate aggregate name '${agg.name}' in bounded context '${bc.name}'`,
        location: { element: agg.name },
      });
    }
    aggNames.add(agg.name);
    validateAggregate(agg, bc.name, errors);
  }

  // Check modules
  for (const mod of bc.modules) {
    for (const agg of mod.aggregates) {
      if (aggNames.has(agg.name)) {
        errors.push({
          type: 'error',
          message: `Duplicate aggregate name '${agg.name}' in bounded context '${bc.name}'`,
          location: { element: agg.name },
        });
      }
      aggNames.add(agg.name);
      validateAggregate(agg, bc.name, errors);
    }
  }
}

function validateAggregate(agg: Aggregate, bcName: string, errors: ValidationError[]): void {
  // Check for aggregate root
  const roots = agg.entities.filter(e => e.aggregateRoot);
  if (roots.length === 0 && agg.entities.length > 0) {
    errors.push({
      type: 'warning',
      message: `Aggregate '${agg.name}' in '${bcName}' has entities but no aggregate root defined`,
      location: { element: agg.name },
    });
  }
  if (roots.length > 1) {
    errors.push({
      type: 'error',
      message: `Aggregate '${agg.name}' in '${bcName}' has multiple aggregate roots`,
      location: { element: agg.name },
    });
  }

  // Check for duplicate entity names
  const entityNames = new Set<string>();
  for (const entity of agg.entities) {
    if (entityNames.has(entity.name)) {
      errors.push({
        type: 'error',
        message: `Duplicate entity name '${entity.name}' in aggregate '${agg.name}'`,
        location: { element: entity.name },
      });
    }
    entityNames.add(entity.name);
  }

  // Check for duplicate value object names
  const voNames = new Set<string>();
  for (const vo of agg.valueObjects) {
    if (voNames.has(vo.name)) {
      errors.push({
        type: 'error',
        message: `Duplicate value object name '${vo.name}' in aggregate '${agg.name}'`,
        location: { element: vo.name },
      });
    }
    voNames.add(vo.name);
  }
}

// Utility function to check if a name is valid CML identifier
export function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

// Utility function to sanitize a name to valid identifier
export function sanitizeIdentifier(name: string): string {
  // Replace invalid characters with underscores
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');

  // Ensure it starts with a letter or underscore
  if (/^[0-9]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  return sanitized || '_unnamed';
}

// Valid CML primitive types
const VALID_PRIMITIVE_TYPES = new Set([
  'String', 'string',
  'int', 'Integer',
  'long', 'Long',
  'float', 'Float',
  'double', 'Double',
  'boolean', 'Boolean',
  'Date', 'DateTime', 'Timestamp',
  'Blob', 'Clob',
  'BigDecimal', 'BigInteger',
  'byte', 'Byte',
  'short', 'Short',
  'char', 'Character',
  'Object', // Generic object reference
  'UUID',
]);

// Types that are NOT valid in CML
const INVALID_TYPE_PATTERNS = [
  { pattern: /^Map\s*</, message: 'Map<K,V> is not supported in CML. Use a Value Object with named fields instead.' },
  { pattern: /^Dictionary\s*</, message: 'Dictionary<K,V> is not supported in CML. Use a Value Object with named fields instead.' },
  { pattern: /^Tuple\s*</, message: 'Tuple is not supported in CML. Use a Value Object with named fields instead.' },
  { pattern: /^Tuple$/, message: 'Tuple is not supported in CML. Use a Value Object with named fields instead.' },
  { pattern: /^Any$/, message: 'Any is not supported in CML. Use a specific type or Object instead.' },
  { pattern: /^any$/, message: 'any is not supported in CML. Use a specific type or Object instead.' },
  { pattern: /^dynamic$/, message: 'dynamic is not supported in CML. Use a specific type or Object instead.' },
  { pattern: /^void$/, message: 'void is not valid for attributes. Remove this attribute or use a specific type.' },
  { pattern: /^Callbacks?$/, message: 'Callback types are not supported in CML. Model the callback contract as a separate Value Object or omit.' },
  { pattern: /^Function\s*</, message: 'Function types are not supported in CML. Model behavior in Services instead.' },
  { pattern: /^Runnable$/, message: 'Runnable is not supported in CML. This is an implementation detail, not a domain concept.' },
];

/**
 * Validates that an attribute type is valid CML syntax.
 * Returns { valid: true } or { valid: false, error: string, suggestion?: string }
 */
export function validateAttributeType(type: string): { valid: boolean; error?: string; suggestion?: string } {
  const trimmedType = type.trim();

  // Check for explicitly invalid patterns first
  for (const { pattern, message } of INVALID_TYPE_PATTERNS) {
    if (pattern.test(trimmedType)) {
      return { valid: false, error: message };
    }
  }

  // Check for reference type (- TypeName)
  if (trimmedType.startsWith('- ')) {
    const refType = trimmedType.slice(2).trim();
    if (!isValidIdentifier(refType)) {
      return {
        valid: false,
        error: `Invalid reference type '${refType}'. Reference types must be valid identifiers.`
      };
    }
    return { valid: true };
  }

  // Check for List or Set collections
  const collectionMatch = trimmedType.match(/^(List|Set)\s*<\s*(.+)\s*>$/);
  if (collectionMatch) {
    const innerType = collectionMatch[2].trim();

    // Check for nested generics (not allowed)
    if (innerType.includes('<')) {
      return {
        valid: false,
        error: `Nested generic types like '${trimmedType}' are not supported in CML.`,
        suggestion: 'Use a Value Object to wrap complex nested structures.'
      };
    }

    // Check for invalid inner types
    for (const { pattern, message } of INVALID_TYPE_PATTERNS) {
      if (pattern.test(innerType)) {
        return { valid: false, error: `Invalid collection element type: ${message}` };
      }
    }

    // Inner type should be a valid identifier (either primitive or domain object reference)
    if (!isValidIdentifier(innerType) && !VALID_PRIMITIVE_TYPES.has(innerType)) {
      return {
        valid: false,
        error: `Invalid collection element type '${innerType}'.`,
        suggestion: `Use a valid type like List<String> or List<YourValueObject>.`
      };
    }

    return { valid: true };
  }

  // Check if it's a primitive type
  if (VALID_PRIMITIVE_TYPES.has(trimmedType)) {
    return { valid: true };
  }

  // Check if it's a valid identifier (domain object reference without -)
  if (isValidIdentifier(trimmedType)) {
    return { valid: true };
  }

  // Unknown or invalid type
  return {
    valid: false,
    error: `Invalid type '${trimmedType}'.`,
    suggestion: `Valid types include: String, int, boolean, DateTime, List<Type>, Set<Type>, or domain object names. Use '- TypeName' for explicit references.`
  };
}

/**
 * Validates all attributes and returns errors for any invalid types.
 */
export function validateAttributes(
  attributes: Array<{ name: string; type: string }>,
  elementName: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const attr of attributes) {
    const typeValidation = validateAttributeType(attr.type);
    if (!typeValidation.valid) {
      let errorMsg = `Attribute '${attr.name}' in '${elementName}' has invalid type: ${typeValidation.error}`;
      if (typeValidation.suggestion) {
        errorMsg += ` ${typeValidation.suggestion}`;
      }
      errors.push(errorMsg);
    }
  }

  return { valid: errors.length === 0, errors };
}
