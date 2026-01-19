/**
 * PlantUML Generator for CML models
 */

import type {
  CMLModel,
  Aggregate,
  Entity,
  ValueObject,
  DomainEvent,
  Command,
  DomainService,
  SymmetricRelationship,
  UpstreamDownstreamRelationship,
} from '../model/types.js';

/**
 * Generate a PlantUML context map diagram
 */
export function generateContextMapDiagram(model: CMLModel, includeAggregates = false): string {
  const lines: string[] = [];

  lines.push('@startuml');
  lines.push('!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml');
  lines.push('');
  lines.push(`title Context Map: ${model.name}`);
  lines.push('');

  // Define bounded contexts as rectangles
  for (const bc of model.boundedContexts) {
    const stereotype = bc.implementationTechnology ? `<<${bc.implementationTechnology}>>` : '';
    lines.push(`rectangle "${bc.name}" as ${sanitizeId(bc.name)} ${stereotype} {`);

    if (includeAggregates && bc.aggregates.length > 0) {
      for (const agg of bc.aggregates) {
        lines.push(`  card "${agg.name}" as ${sanitizeId(bc.name)}_${sanitizeId(agg.name)}`);
      }
    }

    lines.push('}');
    lines.push('');
  }

  // Add relationships
  if (model.contextMap) {
    lines.push("' Relationships");
    for (const rel of model.contextMap.relationships) {
      if (rel.type === 'Partnership') {
        const symRel = rel as SymmetricRelationship;
        lines.push(`${sanitizeId(symRel.participant1)} <--> ${sanitizeId(symRel.participant2)} : Partnership`);
      } else if (rel.type === 'SharedKernel') {
        const symRel = rel as SymmetricRelationship;
        lines.push(`${sanitizeId(symRel.participant1)} <--> ${sanitizeId(symRel.participant2)} : Shared Kernel`);
      } else if (rel.type === 'UpstreamDownstream') {
        const udRel = rel as UpstreamDownstreamRelationship;
        let label = '';

        if (udRel.upstreamPatterns && udRel.upstreamPatterns.length > 0) {
          label += `[${udRel.upstreamPatterns.join(',')}] `;
        }
        label += 'U→D';
        if (udRel.downstreamPatterns && udRel.downstreamPatterns.length > 0) {
          label += ` [${udRel.downstreamPatterns.join(',')}]`;
        }

        lines.push(`${sanitizeId(udRel.upstream)} --> ${sanitizeId(udRel.downstream)} : ${label}`);
      }
    }
  }

  lines.push('');
  lines.push('@enduml');

  return lines.join('\n');
}

/**
 * Generate a PlantUML class diagram for an aggregate
 */
export function generateAggregateDiagram(aggregate: Aggregate): string {
  const lines: string[] = [];

  lines.push('@startuml');
  lines.push(`title Aggregate: ${aggregate.name}`);
  lines.push('');
  lines.push('skinparam classAttributeIconSize 0');
  lines.push('skinparam class {');
  lines.push('  BackgroundColor<<AggregateRoot>> LightGreen');
  lines.push('  BackgroundColor<<Entity>> LightBlue');
  lines.push('  BackgroundColor<<ValueObject>> LightYellow');
  lines.push('  BackgroundColor<<DomainEvent>> LightCoral');
  lines.push('  BackgroundColor<<Command>> LightGray');
  lines.push('  BackgroundColor<<Service>> LightPink');
  lines.push('}');
  lines.push('');

  // Package for the aggregate
  lines.push(`package "${aggregate.name}" {`);
  lines.push('');

  // Entities
  for (const entity of aggregate.entities) {
    const stereotype = entity.aggregateRoot ? 'AggregateRoot' : 'Entity';
    lines.push(`  class ${sanitizeId(entity.name)} <<${stereotype}>> {`);

    for (const attr of entity.attributes) {
      const prefix = attr.key ? '+' : '-';
      const nullable = attr.nullable ? '?' : '';
      lines.push(`    ${prefix}${attr.name}: ${attr.type}${nullable}`);
    }

    if (entity.operations && entity.operations.length > 0) {
      lines.push('    --');
      for (const op of entity.operations) {
        const params = op.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        lines.push(`    +${op.name}(${params}): ${op.returnType || 'void'}`);
      }
    }

    lines.push('  }');
    lines.push('');
  }

  // Value Objects
  for (const vo of aggregate.valueObjects) {
    lines.push(`  class ${sanitizeId(vo.name)} <<ValueObject>> {`);

    for (const attr of vo.attributes) {
      lines.push(`    -${attr.name}: ${attr.type}`);
    }

    lines.push('  }');
    lines.push('');
  }

  // Domain Events
  for (const event of aggregate.domainEvents) {
    lines.push(`  class ${sanitizeId(event.name)} <<DomainEvent>> {`);

    for (const attr of event.attributes) {
      lines.push(`    -${attr.name}: ${attr.type}`);
    }

    lines.push('  }');
    lines.push('');
  }

  // Commands
  for (const cmd of aggregate.commands) {
    lines.push(`  class ${sanitizeId(cmd.name)} <<Command>> {`);

    for (const attr of cmd.attributes) {
      lines.push(`    -${attr.name}: ${attr.type}`);
    }

    lines.push('  }');
    lines.push('');
  }

  // Services
  for (const svc of aggregate.services) {
    lines.push(`  class ${sanitizeId(svc.name)} <<Service>> {`);

    for (const op of svc.operations) {
      const params = op.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
      lines.push(`    +${op.name}(${params}): ${op.returnType || 'void'}`);
    }

    lines.push('  }');
    lines.push('');
  }

  lines.push('}');

  // Add relationships between entities and value objects
  // Aggregate root owns entities
  if (aggregate.aggregateRoot) {
    for (const entity of aggregate.entities) {
      if (!entity.aggregateRoot) {
        lines.push(`${sanitizeId(aggregate.aggregateRoot.name)} *-- ${sanitizeId(entity.name)}`);
      }
    }

    // Aggregate root uses value objects
    for (const vo of aggregate.valueObjects) {
      lines.push(`${sanitizeId(aggregate.aggregateRoot.name)} o-- ${sanitizeId(vo.name)}`);
    }

    // Aggregate root publishes events
    for (const event of aggregate.domainEvents) {
      lines.push(`${sanitizeId(aggregate.aggregateRoot.name)} ..> ${sanitizeId(event.name)} : publishes`);
    }

    // Commands target aggregate root
    for (const cmd of aggregate.commands) {
      lines.push(`${sanitizeId(cmd.name)} ..> ${sanitizeId(aggregate.aggregateRoot.name)} : targets`);
    }
  }

  lines.push('');
  lines.push('@enduml');

  return lines.join('\n');
}

/**
 * Generate a full model diagram with all contexts and their aggregates
 */
export function generateFullModelDiagram(model: CMLModel): string {
  const lines: string[] = [];

  lines.push('@startuml');
  lines.push(`title Domain Model: ${model.name}`);
  lines.push('');
  lines.push('skinparam packageStyle rectangle');
  lines.push('skinparam package {');
  lines.push('  BackgroundColor<<BoundedContext>> LightBlue');
  lines.push('}');
  lines.push('');

  // Each bounded context as a package
  for (const bc of model.boundedContexts) {
    lines.push(`package "${bc.name}" <<BoundedContext>> {`);

    // Aggregates as packages within
    for (const agg of bc.aggregates) {
      lines.push(`  package "${agg.name}" <<Aggregate>> {`);

      // Aggregate root entity
      if (agg.aggregateRoot) {
        lines.push(`    class ${sanitizeId(agg.aggregateRoot.name)} <<AggregateRoot>>`);
      }

      // Other entities
      for (const entity of agg.entities) {
        if (!entity.aggregateRoot) {
          lines.push(`    class ${sanitizeId(entity.name)} <<Entity>>`);
        }
      }

      // Value objects
      for (const vo of agg.valueObjects) {
        lines.push(`    class ${sanitizeId(vo.name)} <<ValueObject>>`);
      }

      lines.push('  }');
    }

    // Module aggregates
    for (const mod of bc.modules) {
      lines.push(`  package "${mod.name}" <<Module>> {`);

      for (const agg of mod.aggregates) {
        lines.push(`    package "${agg.name}" <<Aggregate>> {`);

        if (agg.aggregateRoot) {
          lines.push(`      class ${sanitizeId(agg.aggregateRoot.name)} <<AggregateRoot>>`);
        }

        lines.push('    }');
      }

      lines.push('  }');
    }

    lines.push('}');
    lines.push('');
  }

  // Add context map relationships
  if (model.contextMap) {
    lines.push("' Context Map Relationships");
    for (const rel of model.contextMap.relationships) {
      if (rel.type === 'Partnership') {
        const symRel = rel as SymmetricRelationship;
        lines.push(`"${symRel.participant1}" <..> "${symRel.participant2}" : Partnership`);
      } else if (rel.type === 'SharedKernel') {
        const symRel = rel as SymmetricRelationship;
        lines.push(`"${symRel.participant1}" <..> "${symRel.participant2}" : Shared Kernel`);
      } else if (rel.type === 'UpstreamDownstream') {
        const udRel = rel as UpstreamDownstreamRelationship;
        let label = 'U→D';
        if (udRel.upstreamPatterns && udRel.upstreamPatterns.length > 0) {
          label = `[${udRel.upstreamPatterns.join(',')}] ${label}`;
        }
        if (udRel.downstreamPatterns && udRel.downstreamPatterns.length > 0) {
          label = `${label} [${udRel.downstreamPatterns.join(',')}]`;
        }
        lines.push(`"${udRel.upstream}" ..> "${udRel.downstream}" : ${label}`);
      }
    }
  }

  lines.push('');
  lines.push('@enduml');

  return lines.join('\n');
}

/**
 * Sanitize a name to be a valid PlantUML identifier
 */
function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}
