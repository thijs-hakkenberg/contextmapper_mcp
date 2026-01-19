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

  return {
    valid: errors.filter(e => e.type === 'error').length === 0,
    errors,
  };
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
