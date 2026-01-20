/**
 * CML Writer - Serializes CML model to text format
 */

import type {
  CMLModel,
  ContextMap,
  BoundedContext,
  Aggregate,
  Entity,
  ValueObject,
  DomainEvent,
  Command,
  DomainService,
  ContextRelationship,
  Attribute,
  ServiceOperation,
  Module,
  isSymmetricRelationship,
  isUpstreamDownstreamRelationship,
  SymmetricRelationship,
  UpstreamDownstreamRelationship,
} from './types.js';

// CML reserved keywords that need escaping with ^ when used as identifiers
const RESERVED_KEYWORDS = new Set([
  'abstract', 'action', 'aggregate', 'aggregateRoot', 'application', 'assert', 'async',
  'boundedContext', 'by',
  'case', 'catch', 'class', 'command', 'contains', 'context',
  'def', 'default', 'description', 'do', 'domain', 'domainEvent', 'domainVisionStatement',
  'else', 'entity', 'enum', 'event', 'exposedAggregates', 'extends',
  'false', 'final', 'finally', 'for', 'function',
  'gap', 'get',
  'hint', 'hook',
  'if', 'implements', 'implementationTechnology', 'import', 'in', 'input', 'instanceof',
  'key', 'knowledgeLevel',
  'let', 'list',
  'map', 'module', 'name',
  'new', 'null', 'nullable',
  'of', 'operation', 'optional', 'output',
  'package', 'param', 'path', 'plateau', 'private', 'protected', 'public',
  'query',
  'ref', 'repository', 'required', 'responsibilities', 'result', 'return',
  'scaffold', 'service', 'set', 'state', 'static', 'subdomain', 'super', 'switch',
  'this', 'throw', 'trait', 'true', 'try', 'type',
  'url', 'use',
  'value', 'valueObject', 'var', 'version', 'void',
  'while', 'with',
]);

class CMLWriter {
  private indent = 0;
  private lines: string[] = [];

  // Escape identifier if it's a reserved keyword
  private escapeIdentifier(name: string): string {
    if (RESERVED_KEYWORDS.has(name.toLowerCase())) {
      return `^${name}`;
    }
    return name;
  }

  private write(text: string): void {
    const indentation = '\t'.repeat(this.indent);
    this.lines.push(indentation + text);
  }

  private writeLine(text: string = ''): void {
    if (text) {
      this.write(text);
    } else {
      this.lines.push('');
    }
  }

  private increaseIndent(): void {
    this.indent++;
  }

  private decreaseIndent(): void {
    this.indent = Math.max(0, this.indent - 1);
  }

  public serialize(model: CMLModel): string {
    this.lines = [];
    this.indent = 0;

    // Write context map if present
    if (model.contextMap) {
      this.writeContextMap(model.contextMap);
      this.writeLine();
    }

    // Write bounded contexts
    for (const bc of model.boundedContexts) {
      this.writeBoundedContext(bc);
      this.writeLine();
    }

    return this.lines.join('\n');
  }

  private writeContextMap(contextMap: ContextMap): void {
    this.writeLine(`ContextMap ${contextMap.name} {`);
    this.increaseIndent();

    // State
    if (contextMap.state) {
      this.writeLine(`state = ${contextMap.state}`);
    }

    // Contains
    if (contextMap.boundedContexts.length > 0) {
      this.writeLine(`contains ${contextMap.boundedContexts.join(', ')}`);
    }

    this.writeLine();

    // Relationships
    for (const rel of contextMap.relationships) {
      this.writeRelationship(rel);
    }

    this.decreaseIndent();
    this.writeLine('}');
  }

  private writeRelationship(rel: ContextRelationship): void {
    if (rel.type === 'Partnership' || rel.type === 'SharedKernel') {
      const symRel = rel as SymmetricRelationship;
      this.writeLine(`${symRel.participant1} [${symRel.type}] ${symRel.participant2}`);
    } else if (rel.type === 'UpstreamDownstream') {
      const udRel = rel as UpstreamDownstreamRelationship;

      let upstreamPatterns = '';
      if (udRel.upstreamPatterns && udRel.upstreamPatterns.length > 0) {
        upstreamPatterns = `[U,${udRel.upstreamPatterns.join(',')}]`;
      } else {
        upstreamPatterns = '[U]';
      }

      let downstreamPatterns = '';
      if (udRel.downstreamPatterns && udRel.downstreamPatterns.length > 0) {
        downstreamPatterns = `[D,${udRel.downstreamPatterns.join(',')}]`;
      } else {
        downstreamPatterns = '[D]';
      }

      const hasProps = udRel.exposedAggregates && udRel.exposedAggregates.length > 0;

      if (hasProps) {
        this.writeLine(`${udRel.upstream} ${upstreamPatterns} -> ${downstreamPatterns} ${udRel.downstream} {`);
        this.increaseIndent();
        if (udRel.exposedAggregates && udRel.exposedAggregates.length > 0) {
          this.writeLine(`exposedAggregates = ${udRel.exposedAggregates.join(', ')}`);
        }
        this.decreaseIndent();
        this.writeLine('}');
      } else {
        this.writeLine(`${udRel.upstream} ${upstreamPatterns} -> ${downstreamPatterns} ${udRel.downstream}`);
      }
    }
  }

  private writeBoundedContext(bc: BoundedContext): void {
    this.writeLine(`BoundedContext ${bc.name} {`);
    this.increaseIndent();

    // Properties
    if (bc.domainVisionStatement) {
      this.writeLine(`domainVisionStatement = "${this.escapeString(bc.domainVisionStatement)}"`);
    }

    if (bc.responsibilities && bc.responsibilities.length > 0) {
      const resps = bc.responsibilities.map(r => `"${this.escapeString(r)}"`).join(', ');
      this.writeLine(`responsibilities = ${resps}`);
    }

    if (bc.implementationTechnology) {
      this.writeLine(`implementationTechnology = "${this.escapeString(bc.implementationTechnology)}"`);
    }

    if (bc.knowledgeLevel) {
      this.writeLine(`knowledgeLevel = ${bc.knowledgeLevel}`);
    }

    // Aggregates
    for (const agg of bc.aggregates) {
      this.writeLine();
      this.writeAggregate(agg);
    }

    // Modules
    for (const mod of bc.modules) {
      this.writeLine();
      this.writeModule(mod);
    }

    this.decreaseIndent();
    this.writeLine('}');
  }

  private writeModule(mod: Module): void {
    this.writeLine(`Module ${mod.name} {`);
    this.increaseIndent();

    for (const agg of mod.aggregates) {
      this.writeAggregate(agg);
      this.writeLine();
    }

    this.decreaseIndent();
    this.writeLine('}');
  }

  private writeAggregate(agg: Aggregate): void {
    this.writeLine(`Aggregate ${agg.name} {`);
    this.increaseIndent();

    // Properties
    if (agg.responsibilities && agg.responsibilities.length > 0) {
      const resps = agg.responsibilities.map(r => `"${this.escapeString(r)}"`).join(', ');
      this.writeLine(`responsibilities = ${resps}`);
    }

    if (agg.knowledgeLevel) {
      this.writeLine(`knowledgeLevel = ${agg.knowledgeLevel}`);
    }

    // Entities
    for (const entity of agg.entities) {
      this.writeLine();
      this.writeEntity(entity);
    }

    // Value Objects
    for (const vo of agg.valueObjects) {
      this.writeLine();
      this.writeValueObject(vo);
    }

    // Domain Events
    for (const event of agg.domainEvents) {
      this.writeLine();
      this.writeDomainEvent(event);
    }

    // Commands
    for (const cmd of agg.commands) {
      this.writeLine();
      this.writeCommand(cmd);
    }

    // Services
    for (const svc of agg.services) {
      this.writeLine();
      this.writeService(svc);
    }

    this.decreaseIndent();
    this.writeLine('}');
  }

  private writeEntity(entity: Entity): void {
    if (entity.attributes.length === 0 && (!entity.operations || entity.operations.length === 0) && !entity.aggregateRoot) {
      this.writeLine(`Entity ${entity.name}`);
      return;
    }

    this.writeLine(`Entity ${entity.name} {`);
    this.increaseIndent();

    if (entity.aggregateRoot) {
      this.writeLine('aggregateRoot');
    }

    for (const attr of entity.attributes) {
      this.writeAttribute(attr);
    }

    if (entity.operations) {
      for (const op of entity.operations) {
        this.writeOperation(op);
      }
    }

    this.decreaseIndent();
    this.writeLine('}');
  }

  private writeValueObject(vo: ValueObject): void {
    if (vo.attributes.length === 0) {
      this.writeLine(`ValueObject ${vo.name}`);
      return;
    }

    this.writeLine(`ValueObject ${vo.name} {`);
    this.increaseIndent();

    for (const attr of vo.attributes) {
      this.writeAttribute(attr);
    }

    this.decreaseIndent();
    this.writeLine('}');
  }

  private writeDomainEvent(event: DomainEvent): void {
    if (event.attributes.length === 0) {
      this.writeLine(`DomainEvent ${event.name}`);
      return;
    }

    this.writeLine(`DomainEvent ${event.name} {`);
    this.increaseIndent();

    for (const attr of event.attributes) {
      this.writeAttribute(attr);
    }

    this.decreaseIndent();
    this.writeLine('}');
  }

  private writeCommand(cmd: Command): void {
    if (cmd.attributes.length === 0) {
      this.writeLine(`Command ${cmd.name}`);
      return;
    }

    this.writeLine(`Command ${cmd.name} {`);
    this.increaseIndent();

    for (const attr of cmd.attributes) {
      this.writeAttribute(attr);
    }

    this.decreaseIndent();
    this.writeLine('}');
  }

  private writeService(svc: DomainService): void {
    if (svc.operations.length === 0) {
      this.writeLine(`Service ${svc.name}`);
      return;
    }

    this.writeLine(`Service ${svc.name} {`);
    this.increaseIndent();

    for (const op of svc.operations) {
      this.writeOperation(op);
    }

    this.decreaseIndent();
    this.writeLine('}');
  }

  private writeAttribute(attr: Attribute): void {
    // CML format: Type name key? nullable?
    // Escape attribute name if it's a reserved keyword
    const escapedName = this.escapeIdentifier(attr.name);
    let line = `${attr.type} ${escapedName}`;
    if (attr.key) {
      line += ' key';
    }
    if (attr.nullable) {
      line += ' nullable';
    }
    this.writeLine(line);
  }

  private writeOperation(op: ServiceOperation): void {
    const params = op.parameters.map(p => `${p.type} ${p.name}`).join(', ');
    this.writeLine(`def ${op.returnType || 'void'} ${op.name}(${params})`);
  }

  private escapeString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

export function serializeCML(model: CMLModel): string {
  const writer = new CMLWriter();
  return writer.serialize(model);
}

export { CMLWriter };
