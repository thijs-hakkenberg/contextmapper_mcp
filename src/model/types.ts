/**
 * CML (Context Mapping Language) Type Definitions
 * Based on Context Mapper DSL specification
 */

// Relationship types for Context Maps
export type SymmetricRelationshipType = 'Partnership' | 'SharedKernel';

export type AsymmetricRelationshipType =
  | 'CustomerSupplier'
  | 'Conformist'
  | 'AnticorruptionLayer'
  | 'OpenHostService'
  | 'PublishedLanguage';

export type RelationshipType = SymmetricRelationshipType | AsymmetricRelationshipType;

// Implementation technology patterns
export type ImplementationTechnology = string;

// Knowledge level for aggregates
export type KnowledgeLevel = 'META' | 'CONCRETE';

// Likeness for aggregates
export type Likeness = 'RESPONSIBILITY_LAYER' | 'SERVICE_LAYER' | 'DOMAIN_LAYER' | 'INTERFACE_LAYER';

// Domain Vision Statement types
export interface DomainVisionStatement {
  statement: string;
}

// Base element with ID and name
export interface CMLElement {
  id: string;
  name: string;
  documentation?: string;
}

// Attribute for entities and value objects
export interface Attribute {
  name: string;
  type: string;
  nullable?: boolean;
  key?: boolean;
}

// Domain Event
export interface DomainEvent extends CMLElement {
  attributes: Attribute[];
}

// Command
export interface Command extends CMLElement {
  attributes: Attribute[];
}

// Service operation
export interface ServiceOperation {
  name: string;
  returnType?: string;
  parameters: Array<{ name: string; type: string }>;
}

// Domain Service
export interface DomainService extends CMLElement {
  operations: ServiceOperation[];
}

// Value Object
export interface ValueObject extends CMLElement {
  attributes: Attribute[];
}

// Entity
export interface Entity extends CMLElement {
  attributes: Attribute[];
  operations?: ServiceOperation[];
  aggregateRoot?: boolean;
}

// Aggregate
export interface Aggregate extends CMLElement {
  aggregateRoot?: Entity;
  entities: Entity[];
  valueObjects: ValueObject[];
  domainEvents: DomainEvent[];
  commands: Command[];
  services: DomainService[];
  responsibilities?: string[];
  knowledgeLevel?: KnowledgeLevel;
  likeness?: Likeness;
}

// Module (for organizing within bounded context)
export interface Module extends CMLElement {
  aggregates: Aggregate[];
}

// Bounded Context
export interface BoundedContext extends CMLElement {
  domainVisionStatement?: string;
  responsibilities?: string[];
  implementationTechnology?: ImplementationTechnology;
  knowledgeLevel?: KnowledgeLevel;
  aggregates: Aggregate[];
  modules: Module[];
}

// Upstream/Downstream roles in asymmetric relationships
export type UpstreamDownstreamRole = 'UPSTREAM' | 'DOWNSTREAM';

// Upstream patterns
export type UpstreamPattern = 'OHS' | 'PL';

// Downstream patterns
export type DownstreamPattern = 'ACL' | 'CF';

// Base relationship
export interface BaseRelationship {
  id: string;
  name?: string;
  documentation?: string;
}

// Symmetric relationship (Partnership, SharedKernel)
export interface SymmetricRelationship extends BaseRelationship {
  type: SymmetricRelationshipType;
  participant1: string; // Bounded context name
  participant2: string; // Bounded context name
}

// Upstream-Downstream relationship
export interface UpstreamDownstreamRelationship extends BaseRelationship {
  type: 'UpstreamDownstream';
  upstream: string; // Bounded context name
  downstream: string; // Bounded context name
  upstreamPatterns?: UpstreamPattern[];
  downstreamPatterns?: DownstreamPattern[];
  exposedAggregates?: string[]; // Aggregates exposed by upstream
  downstreamRights?: 'INFLUENCER' | 'OPINIONED_CONFORMIST' | 'VETO_RIGHT';
}

export type ContextRelationship = SymmetricRelationship | UpstreamDownstreamRelationship;

// Context Map
export interface ContextMap extends CMLElement {
  boundedContexts: string[]; // References to bounded context names
  relationships: ContextRelationship[];
  state?: 'AS_IS' | 'TO_BE';
}

// Full CML Model
export interface CMLModel {
  name: string;
  contextMap?: ContextMap;
  boundedContexts: BoundedContext[];
  filePath?: string;
}

// Validation result
export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  location?: {
    line?: number;
    column?: number;
    element?: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Helper type guards
export function isSymmetricRelationship(rel: ContextRelationship): rel is SymmetricRelationship {
  return rel.type === 'Partnership' || rel.type === 'SharedKernel';
}

export function isUpstreamDownstreamRelationship(rel: ContextRelationship): rel is UpstreamDownstreamRelationship {
  return rel.type === 'UpstreamDownstream';
}
