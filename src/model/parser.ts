/**
 * CML Parser using Chevrotain
 * Parses Context Mapper Language (CML) files into typed AST
 */

import { createToken, Lexer, CstParser, CstNode, IToken } from 'chevrotain';
import { v4 as uuidv4 } from 'uuid';
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
  SymmetricRelationship,
  UpstreamDownstreamRelationship,
  Attribute,
  ServiceOperation,
  UpstreamPattern,
  DownstreamPattern,
} from './types.js';

// ============================================
// LEXER TOKENS
// ============================================

// Whitespace and comments
const WhiteSpace = createToken({ name: 'WhiteSpace', pattern: /\s+/, group: Lexer.SKIPPED });
const LineComment = createToken({ name: 'LineComment', pattern: /\/\/[^\n\r]*/, group: Lexer.SKIPPED });
const BlockComment = createToken({ name: 'BlockComment', pattern: /\/\*[\s\S]*?\*\//, group: Lexer.SKIPPED });

// Identifier must be defined first for longer_alt references
const Identifier = createToken({ name: 'Identifier', pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ });

// Keywords - use longer_alt so identifiers like "ServiceNowPlatform" aren't split
const ContextMap = createToken({ name: 'ContextMap', pattern: /ContextMap/, longer_alt: Identifier });
const BoundedContext = createToken({ name: 'BoundedContext', pattern: /BoundedContext/, longer_alt: Identifier });
const Aggregate = createToken({ name: 'Aggregate', pattern: /Aggregate/, longer_alt: Identifier });
const Entity = createToken({ name: 'Entity', pattern: /Entity/, longer_alt: Identifier });
const ValueObject = createToken({ name: 'ValueObject', pattern: /ValueObject/, longer_alt: Identifier });
const DomainEvent = createToken({ name: 'DomainEvent', pattern: /DomainEvent/, longer_alt: Identifier });
const Command = createToken({ name: 'Command', pattern: /Command/, longer_alt: Identifier });
const Service = createToken({ name: 'Service', pattern: /Service/, longer_alt: Identifier });
const Module = createToken({ name: 'Module', pattern: /Module/, longer_alt: Identifier });

// Relationship keywords
const Partnership = createToken({ name: 'Partnership', pattern: /Partnership/, longer_alt: Identifier });
const SharedKernel = createToken({ name: 'SharedKernel', pattern: /SharedKernel/, longer_alt: Identifier });
const CustomerSupplier = createToken({ name: 'CustomerSupplier', pattern: /Customer-Supplier/ });

// Relationship patterns
const UpstreamKw = createToken({ name: 'UpstreamKw', pattern: /[Uu]pstream/, longer_alt: Identifier });
const DownstreamKw = createToken({ name: 'DownstreamKw', pattern: /[Dd]ownstream/, longer_alt: Identifier });
const UpstreamShort = createToken({ name: 'UpstreamShort', pattern: /U(?![a-zA-Z0-9_])/ });
const DownstreamShort = createToken({ name: 'DownstreamShort', pattern: /D(?![a-zA-Z0-9_])/ });
const OHS = createToken({ name: 'OHS', pattern: /OHS/, longer_alt: Identifier });
const PL = createToken({ name: 'PL', pattern: /PL/, longer_alt: Identifier });
const ACL = createToken({ name: 'ACL', pattern: /ACL/, longer_alt: Identifier });
const CF = createToken({ name: 'CF', pattern: /CF/, longer_alt: Identifier });

// Property keywords
const Contains = createToken({ name: 'Contains', pattern: /contains/, longer_alt: Identifier });
const Implements = createToken({ name: 'Implements', pattern: /implements/, longer_alt: Identifier });
const Type = createToken({ name: 'Type', pattern: /type/, longer_alt: Identifier });
const State = createToken({ name: 'State', pattern: /state/, longer_alt: Identifier });
const DomainVisionStatement = createToken({ name: 'DomainVisionStatement', pattern: /domainVisionStatement/, longer_alt: Identifier });
const Responsibilities = createToken({ name: 'Responsibilities', pattern: /responsibilities/, longer_alt: Identifier });
const ImplementationTechnology = createToken({ name: 'ImplementationTechnology', pattern: /implementationTechnology/, longer_alt: Identifier });
const KnowledgeLevel = createToken({ name: 'KnowledgeLevel', pattern: /knowledgeLevel/, longer_alt: Identifier });
const AggregateRoot = createToken({ name: 'AggregateRoot', pattern: /aggregateRoot/, longer_alt: Identifier });
const Def = createToken({ name: 'Def', pattern: /def/, longer_alt: Identifier });
const Key = createToken({ name: 'Key', pattern: /key/, longer_alt: Identifier });
const Nullable = createToken({ name: 'Nullable', pattern: /nullable/, longer_alt: Identifier });
const ExposedAggregates = createToken({ name: 'ExposedAggregates', pattern: /exposedAggregates/, longer_alt: Identifier });

// Collection types
const ListType = createToken({ name: 'ListType', pattern: /List/, longer_alt: Identifier });
const SetType = createToken({ name: 'SetType', pattern: /Set/, longer_alt: Identifier });
const LAngle = createToken({ name: 'LAngle', pattern: /</ });
const RAngle = createToken({ name: 'RAngle', pattern: />/ });

// State keywords
const AsIs = createToken({ name: 'AsIs', pattern: /AS_IS/, longer_alt: Identifier });
const ToBe = createToken({ name: 'ToBe', pattern: /TO_BE/, longer_alt: Identifier });
const Meta = createToken({ name: 'Meta', pattern: /META/, longer_alt: Identifier });
const Concrete = createToken({ name: 'Concrete', pattern: /CONCRETE/, longer_alt: Identifier });

// Symbols
const LCurly = createToken({ name: 'LCurly', pattern: /{/ });
const RCurly = createToken({ name: 'RCurly', pattern: /}/ });
const LParen = createToken({ name: 'LParen', pattern: /\(/ });
const RParen = createToken({ name: 'RParen', pattern: /\)/ });
const LSquare = createToken({ name: 'LSquare', pattern: /\[/ });
const RSquare = createToken({ name: 'RSquare', pattern: /\]/ });
const Comma = createToken({ name: 'Comma', pattern: /,/ });
const Colon = createToken({ name: 'Colon', pattern: /:/ });
const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
const Equals = createToken({ name: 'Equals', pattern: /=/ });
const Arrow = createToken({ name: 'Arrow', pattern: /->/ });
const DoubleArrow = createToken({ name: 'DoubleArrow', pattern: /<->/ });
const UpstreamDownstreamArrow = createToken({ name: 'UpstreamDownstreamArrow', pattern: /U->D|D<-U/ });
const DownstreamUpstreamArrow = createToken({ name: 'DownstreamUpstreamArrow', pattern: /D->U|U<-D/ });

// Literals
const StringLiteral = createToken({ name: 'StringLiteral', pattern: /"[^"]*"/ });
// Note: Identifier is defined earlier for longer_alt references

// All tokens in order (order matters for lexer)
const allTokens = [
  WhiteSpace,
  LineComment,
  BlockComment,
  // Multi-char operators first
  DoubleArrow,
  UpstreamDownstreamArrow,
  DownstreamUpstreamArrow,
  Arrow,
  // Keywords before Identifier
  ContextMap,
  BoundedContext,
  Aggregate,
  Entity,
  ValueObject,
  DomainEvent,
  Command,
  Service,
  Module,
  Partnership,
  SharedKernel,
  CustomerSupplier,
  UpstreamKw,
  DownstreamKw,
  UpstreamShort,
  DownstreamShort,
  OHS,
  PL,
  ACL,
  CF,
  Contains,
  Implements,
  Type,
  State,
  DomainVisionStatement,
  Responsibilities,
  ImplementationTechnology,
  KnowledgeLevel,
  AggregateRoot,
  Def,
  Key,
  Nullable,
  ExposedAggregates,
  ListType,
  SetType,
  AsIs,
  ToBe,
  Meta,
  Concrete,
  // Symbols
  LCurly,
  RCurly,
  LParen,
  RParen,
  LSquare,
  RSquare,
  LAngle,
  RAngle,
  Comma,
  Colon,
  Semicolon,
  Equals,
  // Literals
  StringLiteral,
  Identifier,
];

const CMLLexer = new Lexer(allTokens);

// ============================================
// PARSER
// ============================================

class CMLParserClass extends CstParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  // Entry rule
  public cmlModel = this.RULE('cmlModel', () => {
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.contextMapDecl) },
        { ALT: () => this.SUBRULE(this.boundedContextDecl) },
      ]);
    });
  });

  // Context Map declaration
  private contextMapDecl = this.RULE('contextMapDecl', () => {
    this.CONSUME(ContextMap);
    this.OPTION(() => this.CONSUME(Identifier));
    this.CONSUME(LCurly);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.contextMapType) },
        { ALT: () => this.SUBRULE(this.contextMapState) },
        { ALT: () => this.SUBRULE(this.contextMapContains) },
        { ALT: () => this.SUBRULE(this.relationshipDecl) },
      ]);
    });
    this.CONSUME(RCurly);
  });

  // type = SYSTEM_LANDSCAPE | ORGANIZATIONAL
  private contextMapType = this.RULE('contextMapType', () => {
    this.CONSUME(Type);
    this.OPTION(() => this.CONSUME(Equals));
    this.CONSUME(Identifier); // SYSTEM_LANDSCAPE or ORGANIZATIONAL
  });

  // state = AS_IS | TO_BE
  private contextMapState = this.RULE('contextMapState', () => {
    this.CONSUME(State);
    this.OPTION(() => this.CONSUME(Equals));
    this.OR([
      { ALT: () => this.CONSUME(AsIs) },
      { ALT: () => this.CONSUME(ToBe) },
    ]);
  });

  private contextMapContains = this.RULE('contextMapContains', () => {
    this.CONSUME(Contains);
    this.AT_LEAST_ONE_SEP({
      SEP: Comma,
      DEF: () => this.CONSUME(Identifier),
    });
  });

  // Relationship declarations
  private relationshipDecl = this.RULE('relationshipDecl', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.symmetricRelationship) },
      { ALT: () => this.SUBRULE(this.upstreamDownstreamRelationship) },
    ]);
  });

  private symmetricRelationship = this.RULE('symmetricRelationship', () => {
    this.CONSUME(Identifier);
    this.OR([
      { ALT: () => this.CONSUME(Partnership) },
      { ALT: () => this.CONSUME(SharedKernel) },
    ]);
    this.CONSUME2(Identifier);
  });

  // Upstream-downstream: Context1 [U,OHS,PL] -> [D,ACL] Context2
  private upstreamDownstreamRelationship = this.RULE('upstreamDownstreamRelationship', () => {
    // First context name
    this.CONSUME(Identifier);
    // Optional upstream patterns [U,OHS,PL]
    this.OPTION(() => {
      this.CONSUME(LSquare);
      this.SUBRULE(this.upstreamPatterns);
      this.CONSUME(RSquare);
    });
    // Arrow
    this.CONSUME(Arrow);
    // Optional downstream patterns [D,ACL]
    this.OPTION2(() => {
      this.CONSUME2(LSquare);
      this.SUBRULE(this.downstreamPatterns);
      this.CONSUME2(RSquare);
    });
    // Second context name
    this.CONSUME2(Identifier);
    // Optional properties block
    this.OPTION3(() => {
      this.CONSUME(LCurly);
      this.MANY(() => this.SUBRULE(this.relationshipProperty));
      this.CONSUME(RCurly);
    });
  });

  // [U,OHS,PL] or [U] or [Upstream,OHS]
  private upstreamPatterns = this.RULE('upstreamPatterns', () => {
    this.OR([
      { ALT: () => this.CONSUME(UpstreamShort) },
      { ALT: () => this.CONSUME(UpstreamKw) },
    ]);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.OR2([
        { ALT: () => this.CONSUME(OHS) },
        { ALT: () => this.CONSUME(PL) },
      ]);
    });
  });

  // [D,ACL] or [D] or [Downstream,CF]
  private downstreamPatterns = this.RULE('downstreamPatterns', () => {
    this.OR([
      { ALT: () => this.CONSUME(DownstreamShort) },
      { ALT: () => this.CONSUME(DownstreamKw) },
    ]);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.OR2([
        { ALT: () => this.CONSUME(ACL) },
        { ALT: () => this.CONSUME(CF) },
      ]);
    });
  });

  private relationshipProperty = this.RULE('relationshipProperty', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.exposedAggregatesProperty) },
    ]);
  });

  private exposedAggregatesProperty = this.RULE('exposedAggregatesProperty', () => {
    this.CONSUME(ExposedAggregates);
    this.CONSUME(Equals);
    this.CONSUME(Identifier);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.CONSUME2(Identifier);
    });
  });

  // Bounded Context declaration
  private boundedContextDecl = this.RULE('boundedContextDecl', () => {
    this.CONSUME(BoundedContext);
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(Implements);
      this.CONSUME2(Identifier);
    });
    this.CONSUME(LCurly);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.domainVisionStatementDecl) },
        { ALT: () => this.SUBRULE(this.responsibilitiesDecl) },
        { ALT: () => this.SUBRULE(this.implementationTechnologyDecl) },
        { ALT: () => this.SUBRULE(this.knowledgeLevelDecl) },
        { ALT: () => this.SUBRULE(this.aggregateDecl) },
        { ALT: () => this.SUBRULE(this.moduleDecl) },
      ]);
    });
    this.CONSUME(RCurly);
  });

  private domainVisionStatementDecl = this.RULE('domainVisionStatementDecl', () => {
    this.CONSUME(DomainVisionStatement);
    this.CONSUME(Equals);
    this.CONSUME(StringLiteral);
  });

  private responsibilitiesDecl = this.RULE('responsibilitiesDecl', () => {
    this.CONSUME(Responsibilities);
    this.CONSUME(Equals);
    this.CONSUME(StringLiteral);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.CONSUME2(StringLiteral);
    });
  });

  private implementationTechnologyDecl = this.RULE('implementationTechnologyDecl', () => {
    this.CONSUME(ImplementationTechnology);
    this.CONSUME(Equals);
    this.CONSUME(StringLiteral);
  });

  private knowledgeLevelDecl = this.RULE('knowledgeLevelDecl', () => {
    this.CONSUME(KnowledgeLevel);
    this.CONSUME(Equals);
    this.OR([
      { ALT: () => this.CONSUME(Meta) },
      { ALT: () => this.CONSUME(Concrete) },
    ]);
  });

  // Module declaration
  private moduleDecl = this.RULE('moduleDecl', () => {
    this.CONSUME(Module);
    this.CONSUME(Identifier);
    this.CONSUME(LCurly);
    this.MANY(() => this.SUBRULE(this.aggregateDecl));
    this.CONSUME(RCurly);
  });

  // Aggregate declaration
  private aggregateDecl = this.RULE('aggregateDecl', () => {
    this.CONSUME(Aggregate);
    this.CONSUME(Identifier);
    this.CONSUME(LCurly);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.responsibilitiesDecl) },
        { ALT: () => this.SUBRULE(this.knowledgeLevelDecl) },
        { ALT: () => this.SUBRULE(this.entityDecl) },
        { ALT: () => this.SUBRULE(this.valueObjectDecl) },
        { ALT: () => this.SUBRULE(this.domainEventDecl) },
        { ALT: () => this.SUBRULE(this.commandDecl) },
        { ALT: () => this.SUBRULE(this.serviceDecl) },
      ]);
    });
    this.CONSUME(RCurly);
  });

  // Entity declaration
  private entityDecl = this.RULE('entityDecl', () => {
    this.CONSUME(Entity);
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(LCurly);
      this.MANY(() => {
        this.OR([
          { ALT: () => this.SUBRULE(this.aggregateRootDecl) },
          { ALT: () => this.SUBRULE(this.attributeDecl) },
          { ALT: () => this.SUBRULE(this.operationDecl) },
        ]);
      });
      this.CONSUME(RCurly);
    });
  });

  private aggregateRootDecl = this.RULE('aggregateRootDecl', () => {
    this.CONSUME(AggregateRoot);
  });

  // Value Object declaration
  private valueObjectDecl = this.RULE('valueObjectDecl', () => {
    this.CONSUME(ValueObject);
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(LCurly);
      this.MANY(() => this.SUBRULE(this.attributeDecl));
      this.CONSUME(RCurly);
    });
  });

  // Domain Event declaration
  private domainEventDecl = this.RULE('domainEventDecl', () => {
    this.CONSUME(DomainEvent);
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(LCurly);
      this.MANY(() => this.SUBRULE(this.attributeDecl));
      this.CONSUME(RCurly);
    });
  });

  // Command declaration
  private commandDecl = this.RULE('commandDecl', () => {
    this.CONSUME(Command);
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(LCurly);
      this.MANY(() => this.SUBRULE(this.attributeDecl));
      this.CONSUME(RCurly);
    });
  });

  // Service declaration
  private serviceDecl = this.RULE('serviceDecl', () => {
    this.CONSUME(Service);
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(LCurly);
      this.MANY(() => this.SUBRULE(this.operationDecl));
      this.CONSUME(RCurly);
    });
  });

  // Attribute declaration: Type name key? nullable? ;?
  // Also supports: List<Type> name or Set<Type> name
  // Attribute name - can be identifier or certain keywords used as names
  private attributeName = this.RULE('attributeName', () => {
    this.OR([
      { ALT: () => this.CONSUME(Identifier) },
      { ALT: () => this.CONSUME(Type) }, // 'type' is often used as attr name
      { ALT: () => this.CONSUME(State) }, // 'state' is often used as attr name
      { ALT: () => this.CONSUME(Key) }, // 'key' can be an attr name
      { ALT: () => this.CONSUME(Service) }, // 'service' can be an attr name
      { ALT: () => this.CONSUME(Module) }, // 'module' can be an attr name
    ]);
  });

  private attributeDecl = this.RULE('attributeDecl', () => {
    // Type (can be collection type like List<String>)
    this.OR([
      {
        ALT: () => {
          this.OR2([
            { ALT: () => this.CONSUME(ListType) },
            { ALT: () => this.CONSUME(SetType) },
          ]);
          this.CONSUME(LAngle);
          this.CONSUME(Identifier); // inner type
          this.CONSUME(RAngle);
        },
      },
      { ALT: () => this.CONSUME2(Identifier) }, // simple type
    ]);
    // Name - can be identifier or keyword
    this.SUBRULE(this.attributeName);
    // Optional modifiers (after name)
    this.OPTION(() => this.CONSUME2(Key));
    this.OPTION2(() => this.CONSUME(Nullable));
    // Optional semicolon
    this.OPTION3(() => this.CONSUME(Semicolon));
  });

  // Operation declaration
  private operationDecl = this.RULE('operationDecl', () => {
    this.CONSUME(Def);
    this.CONSUME(Identifier); // return type or void
    this.CONSUME2(Identifier); // method name
    this.CONSUME(LParen);
    this.OPTION(() => {
      this.SUBRULE(this.parameterDecl);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.SUBRULE2(this.parameterDecl);
      });
    });
    this.CONSUME(RParen);
  });

  private parameterDecl = this.RULE('parameterDecl', () => {
    this.CONSUME(Identifier); // type
    this.CONSUME2(Identifier); // name
  });
}

// Create parser instance
const parser = new CMLParserClass();

// ============================================
// AST VISITOR
// ============================================

interface CstChildNode {
  name: string;
  children: Record<string, (CstNode | IToken)[]>;
}

type CstChildren = Record<string, (CstNode | IToken)[]>;

function getToken(children: CstChildren, tokenName: string, index = 0): IToken | undefined {
  const tokens = children[tokenName];
  if (tokens && tokens.length > index) {
    return tokens[index] as IToken;
  }
  return undefined;
}

function getNode(children: CstChildren, nodeName: string, index = 0): CstNode | undefined {
  const nodes = children[nodeName];
  if (nodes && nodes.length > index) {
    return nodes[index] as CstNode;
  }
  return undefined;
}

function getAllNodes(children: CstChildren, nodeName: string): CstNode[] {
  const nodes = children[nodeName];
  return (nodes || []) as CstNode[];
}

function getAllTokens(children: CstChildren, tokenName: string): IToken[] {
  const tokens = children[tokenName];
  return (tokens || []) as IToken[];
}

function stripQuotes(str: string): string {
  return str.replace(/^"|"$/g, '');
}

// Visitor to build typed model from CST
function visitCmlModel(cst: CstNode): CMLModel {
  const model: CMLModel = {
    name: 'Untitled',
    boundedContexts: [],
  };

  const children = cst.children;

  // Process context maps
  const contextMapNodes = getAllNodes(children, 'contextMapDecl');
  if (contextMapNodes.length > 0) {
    model.contextMap = visitContextMap(contextMapNodes[0]);
  }

  // Process bounded contexts
  const bcNodes = getAllNodes(children, 'boundedContextDecl');
  for (const bcNode of bcNodes) {
    model.boundedContexts.push(visitBoundedContext(bcNode));
  }

  return model;
}

function visitContextMap(cst: CstNode): ContextMap {
  const children = cst.children;
  const nameToken = getToken(children, 'Identifier');

  const contextMap: ContextMap = {
    id: uuidv4(),
    name: nameToken?.image || 'MainContextMap',
    boundedContexts: [],
    relationships: [],
  };

  // Process state
  const stateNodes = getAllNodes(children, 'contextMapState');
  if (stateNodes.length > 0) {
    const stateChildren = stateNodes[0].children;
    if (stateChildren['AsIs']) {
      contextMap.state = 'AS_IS';
    } else if (stateChildren['ToBe']) {
      contextMap.state = 'TO_BE';
    }
  }

  // Process contains
  const containsNodes = getAllNodes(children, 'contextMapContains');
  for (const containsNode of containsNodes) {
    const identifiers = getAllTokens(containsNode.children, 'Identifier');
    for (const id of identifiers) {
      contextMap.boundedContexts.push(id.image);
    }
  }

  // Process relationships
  const relNodes = getAllNodes(children, 'relationshipDecl');
  for (const relNode of relNodes) {
    const rel = visitRelationship(relNode);
    if (rel) {
      contextMap.relationships.push(rel);
    }
  }

  return contextMap;
}

function visitRelationship(cst: CstNode): ContextRelationship | undefined {
  const children = cst.children;

  // Symmetric relationship
  const symRelNode = getNode(children, 'symmetricRelationship');
  if (symRelNode) {
    const symChildren = symRelNode.children;
    const identifiers = getAllTokens(symChildren, 'Identifier');

    let type: 'Partnership' | 'SharedKernel' = 'Partnership';
    if (symChildren['SharedKernel']) {
      type = 'SharedKernel';
    }

    return {
      id: uuidv4(),
      type,
      participant1: identifiers[0]?.image || '',
      participant2: identifiers[1]?.image || '',
    } as SymmetricRelationship;
  }

  // Upstream-Downstream relationship
  // Format: Context1 [U,OHS,PL] -> [D,ACL] Context2
  const udRelNode = getNode(children, 'upstreamDownstreamRelationship');
  if (udRelNode) {
    const udChildren = udRelNode.children;
    const identifiers = getAllTokens(udChildren, 'Identifier');

    // First identifier is upstream, second is downstream
    const rel: UpstreamDownstreamRelationship = {
      id: uuidv4(),
      type: 'UpstreamDownstream',
      upstream: identifiers[0]?.image || '',
      downstream: identifiers[1]?.image || '',
      upstreamPatterns: [],
      downstreamPatterns: [],
    };

    // Get patterns
    const upstreamPatternsNode = getNode(udChildren, 'upstreamPatterns');
    if (upstreamPatternsNode) {
      const upChildren = upstreamPatternsNode.children;
      const ohsTokens = getAllTokens(upChildren, 'OHS');
      const plTokens = getAllTokens(upChildren, 'PL');
      if (ohsTokens.length > 0) rel.upstreamPatterns!.push('OHS');
      if (plTokens.length > 0) rel.upstreamPatterns!.push('PL');
    }

    const downstreamPatternsNode = getNode(udChildren, 'downstreamPatterns');
    if (downstreamPatternsNode) {
      const downChildren = downstreamPatternsNode.children;
      const aclTokens = getAllTokens(downChildren, 'ACL');
      const cfTokens = getAllTokens(downChildren, 'CF');
      if (aclTokens.length > 0) rel.downstreamPatterns!.push('ACL');
      if (cfTokens.length > 0) rel.downstreamPatterns!.push('CF');
    }

    // Get exposed aggregates
    const relPropNodes = getAllNodes(udChildren, 'relationshipProperty');
    for (const propNode of relPropNodes) {
      const expAggNode = getNode(propNode.children, 'exposedAggregatesProperty');
      if (expAggNode) {
        const aggIds = getAllTokens(expAggNode.children, 'Identifier');
        rel.exposedAggregates = aggIds.map(t => t.image);
      }
    }

    return rel;
  }

  return undefined;
}

function visitBoundedContext(cst: CstNode): BoundedContext {
  const children = cst.children;
  const nameToken = getToken(children, 'Identifier');

  const bc: BoundedContext = {
    id: uuidv4(),
    name: nameToken?.image || 'UnnamedContext',
    aggregates: [],
    modules: [],
  };

  // Domain vision statement
  const dvsNodes = getAllNodes(children, 'domainVisionStatementDecl');
  if (dvsNodes.length > 0) {
    const strToken = getToken(dvsNodes[0].children, 'StringLiteral');
    if (strToken) {
      bc.domainVisionStatement = stripQuotes(strToken.image);
    }
  }

  // Responsibilities
  const respNodes = getAllNodes(children, 'responsibilitiesDecl');
  if (respNodes.length > 0) {
    const strTokens = getAllTokens(respNodes[0].children, 'StringLiteral');
    bc.responsibilities = strTokens.map(t => stripQuotes(t.image));
  }

  // Implementation technology
  const implTechNodes = getAllNodes(children, 'implementationTechnologyDecl');
  if (implTechNodes.length > 0) {
    const strToken = getToken(implTechNodes[0].children, 'StringLiteral');
    if (strToken) {
      bc.implementationTechnology = stripQuotes(strToken.image);
    }
  }

  // Knowledge level
  const klNodes = getAllNodes(children, 'knowledgeLevelDecl');
  if (klNodes.length > 0) {
    const klChildren = klNodes[0].children;
    if (klChildren['Meta']) {
      bc.knowledgeLevel = 'META';
    } else if (klChildren['Concrete']) {
      bc.knowledgeLevel = 'CONCRETE';
    }
  }

  // Aggregates
  const aggNodes = getAllNodes(children, 'aggregateDecl');
  for (const aggNode of aggNodes) {
    bc.aggregates.push(visitAggregate(aggNode));
  }

  // Modules
  const modNodes = getAllNodes(children, 'moduleDecl');
  for (const modNode of modNodes) {
    const modChildren = modNode.children;
    const modName = getToken(modChildren, 'Identifier')?.image || 'UnnamedModule';
    const module = {
      id: uuidv4(),
      name: modName,
      aggregates: [] as Aggregate[],
    };
    const modAggNodes = getAllNodes(modChildren, 'aggregateDecl');
    for (const aggNode of modAggNodes) {
      module.aggregates.push(visitAggregate(aggNode));
    }
    bc.modules.push(module);
  }

  return bc;
}

function visitAggregate(cst: CstNode): Aggregate {
  const children = cst.children;
  const nameToken = getToken(children, 'Identifier');

  const agg: Aggregate = {
    id: uuidv4(),
    name: nameToken?.image || 'UnnamedAggregate',
    entities: [],
    valueObjects: [],
    domainEvents: [],
    commands: [],
    services: [],
  };

  // Responsibilities
  const respNodes = getAllNodes(children, 'responsibilitiesDecl');
  if (respNodes.length > 0) {
    const strTokens = getAllTokens(respNodes[0].children, 'StringLiteral');
    agg.responsibilities = strTokens.map(t => stripQuotes(t.image));
  }

  // Knowledge level
  const klNodes = getAllNodes(children, 'knowledgeLevelDecl');
  if (klNodes.length > 0) {
    const klChildren = klNodes[0].children;
    if (klChildren['Meta']) {
      agg.knowledgeLevel = 'META';
    } else if (klChildren['Concrete']) {
      agg.knowledgeLevel = 'CONCRETE';
    }
  }

  // Entities
  const entityNodes = getAllNodes(children, 'entityDecl');
  for (const entityNode of entityNodes) {
    const entity = visitEntity(entityNode);
    if (entity.aggregateRoot) {
      agg.aggregateRoot = entity;
    }
    agg.entities.push(entity);
  }

  // Value Objects
  const voNodes = getAllNodes(children, 'valueObjectDecl');
  for (const voNode of voNodes) {
    agg.valueObjects.push(visitValueObject(voNode));
  }

  // Domain Events
  const eventNodes = getAllNodes(children, 'domainEventDecl');
  for (const eventNode of eventNodes) {
    agg.domainEvents.push(visitDomainEvent(eventNode));
  }

  // Commands
  const cmdNodes = getAllNodes(children, 'commandDecl');
  for (const cmdNode of cmdNodes) {
    agg.commands.push(visitCommand(cmdNode));
  }

  // Services
  const svcNodes = getAllNodes(children, 'serviceDecl');
  for (const svcNode of svcNodes) {
    agg.services.push(visitService(svcNode));
  }

  return agg;
}

function visitEntity(cst: CstNode): Entity {
  const children = cst.children;
  const nameToken = getToken(children, 'Identifier');

  const entity: Entity = {
    id: uuidv4(),
    name: nameToken?.image || 'UnnamedEntity',
    attributes: [],
    operations: [],
  };

  // Check for aggregate root
  const aggRootNodes = getAllNodes(children, 'aggregateRootDecl');
  if (aggRootNodes.length > 0) {
    entity.aggregateRoot = true;
  }

  // Attributes
  const attrNodes = getAllNodes(children, 'attributeDecl');
  for (const attrNode of attrNodes) {
    entity.attributes.push(visitAttribute(attrNode));
  }

  // Operations
  const opNodes = getAllNodes(children, 'operationDecl');
  for (const opNode of opNodes) {
    entity.operations!.push(visitOperation(opNode));
  }

  return entity;
}

function visitValueObject(cst: CstNode): ValueObject {
  const children = cst.children;
  const nameToken = getToken(children, 'Identifier');

  const vo: ValueObject = {
    id: uuidv4(),
    name: nameToken?.image || 'UnnamedValueObject',
    attributes: [],
  };

  // Attributes
  const attrNodes = getAllNodes(children, 'attributeDecl');
  for (const attrNode of attrNodes) {
    vo.attributes.push(visitAttribute(attrNode));
  }

  return vo;
}

function visitDomainEvent(cst: CstNode): DomainEvent {
  const children = cst.children;
  const nameToken = getToken(children, 'Identifier');

  const event: DomainEvent = {
    id: uuidv4(),
    name: nameToken?.image || 'UnnamedEvent',
    attributes: [],
  };

  // Attributes
  const attrNodes = getAllNodes(children, 'attributeDecl');
  for (const attrNode of attrNodes) {
    event.attributes.push(visitAttribute(attrNode));
  }

  return event;
}

function visitCommand(cst: CstNode): Command {
  const children = cst.children;
  const nameToken = getToken(children, 'Identifier');

  const cmd: Command = {
    id: uuidv4(),
    name: nameToken?.image || 'UnnamedCommand',
    attributes: [],
  };

  // Attributes
  const attrNodes = getAllNodes(children, 'attributeDecl');
  for (const attrNode of attrNodes) {
    cmd.attributes.push(visitAttribute(attrNode));
  }

  return cmd;
}

function visitService(cst: CstNode): DomainService {
  const children = cst.children;
  const nameToken = getToken(children, 'Identifier');

  const svc: DomainService = {
    id: uuidv4(),
    name: nameToken?.image || 'UnnamedService',
    operations: [],
  };

  // Operations
  const opNodes = getAllNodes(children, 'operationDecl');
  for (const opNode of opNodes) {
    svc.operations.push(visitOperation(opNode));
  }

  return svc;
}

function visitAttribute(cst: CstNode): Attribute {
  const children = cst.children;
  const identifiers = getAllTokens(children, 'Identifier');

  let type: string;
  let name: string;

  // Extract attribute name from attributeName subrule
  const attrNameNode = getNode(children, 'attributeName');
  if (attrNameNode) {
    const nameChildren = attrNameNode.children;
    // Try to get name from any of the possible tokens
    const nameToken =
      getToken(nameChildren, 'Identifier') ||
      getToken(nameChildren, 'Type') ||
      getToken(nameChildren, 'State') ||
      getToken(nameChildren, 'Key') ||
      getToken(nameChildren, 'Service') ||
      getToken(nameChildren, 'Module');
    name = nameToken?.image || 'unnamed';
  } else {
    // Fallback for old structure
    name = identifiers[1]?.image || 'unnamed';
  }

  // Check for collection types (List<Type> or Set<Type>)
  if (children['ListType'] || children['SetType']) {
    const collectionType = children['ListType'] ? 'List' : 'Set';
    const innerType = identifiers[0]?.image || 'Object';
    type = `${collectionType}<${innerType}>`;
  } else {
    // Simple type: Type name
    type = identifiers[0]?.image || 'String';
  }

  const attr: Attribute = { type, name };

  if (children['Key']) {
    attr.key = true;
  }

  if (children['Nullable']) {
    attr.nullable = true;
  }

  return attr;
}

function visitOperation(cst: CstNode): ServiceOperation {
  const children = cst.children;
  const identifiers = getAllTokens(children, 'Identifier');

  const op: ServiceOperation = {
    returnType: identifiers[0]?.image || 'void',
    name: identifiers[1]?.image || 'unnamed',
    parameters: [],
  };

  // Parameters
  const paramNodes = getAllNodes(children, 'parameterDecl');
  for (const paramNode of paramNodes) {
    const paramIds = getAllTokens(paramNode.children, 'Identifier');
    op.parameters.push({
      type: paramIds[0]?.image || 'Object',
      name: paramIds[1]?.image || 'param',
    });
  }

  return op;
}

// ============================================
// PUBLIC API
// ============================================

export interface ParseResult {
  success: boolean;
  model?: CMLModel;
  errors: Array<{
    message: string;
    line?: number;
    column?: number;
  }>;
}

export function parseCML(text: string): ParseResult {
  // Lexing
  const lexResult = CMLLexer.tokenize(text);

  if (lexResult.errors.length > 0) {
    return {
      success: false,
      errors: lexResult.errors.map(e => ({
        message: e.message,
        line: e.line,
        column: e.column,
      })),
    };
  }

  // Parsing
  parser.input = lexResult.tokens;
  const cst = parser.cmlModel();

  if (parser.errors.length > 0) {
    return {
      success: false,
      errors: parser.errors.map(e => ({
        message: e.message,
        line: e.token?.startLine,
        column: e.token?.startColumn,
      })),
    };
  }

  // Build AST
  const model = visitCmlModel(cst);

  return {
    success: true,
    model,
    errors: [],
  };
}

export { CMLLexer, CMLParserClass as CMLParser };
