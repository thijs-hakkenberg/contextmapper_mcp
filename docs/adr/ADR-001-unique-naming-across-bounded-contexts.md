# ADR-001: Unique Naming Across Bounded Contexts

## Status
Accepted

## Date
2025-01-21

## Context
When modeling domain-driven designs with multiple bounded contexts, it's common to have similar concepts across contexts. For example, an `AgentId` might exist in both an A2A (Agent-to-Agent) context and a Databricks platform context.

However, CML (Context Mapping Language) treats all domain object names as globally visible types. When multiple bounded contexts define the same type name (e.g., `AgentId`), CML tools produce an error:

```
The reference to the type 'AgentId' is ambiguous. There is more than one element with the same name.
```

This error occurs because CML cannot determine which `AgentId` is being referenced when the type is used in relationships or other constructs.

## Decision
We will enforce unique domain object names across all bounded contexts at creation time. The validation system will:

1. Track all domain object names (Value Objects, Entities, Domain Events, Commands) across all bounded contexts
2. Reject new domain objects if their name already exists in any other bounded context
3. Provide helpful error messages with suggestions for unique prefixed names

### Naming Convention
Use context-specific prefixes for domain objects:

| Context | ID Name | Instead of |
|---------|---------|------------|
| A2AServer | `A2AAgentId` | `AgentId` |
| DatabricksPlatform | `DatabricksAgentId` | `AgentId` |
| ServiceNowPlatform | `SNOWAgentId` | `AgentId` |

## Consequences

### Positive
- Models are always valid and can be processed by CML tools
- Clear ownership of domain objects to their bounded context
- No ambiguous type references at runtime
- Early feedback at creation time prevents wasted modeling effort

### Negative
- Longer type names
- Cannot have truly "shared" domain objects without a SharedKernel relationship
- Requires discipline from modelers to use prefixes consistently

## Implementation
- Added `validateNoDuplicateDomainObjectNames()` in `validation.ts`
- Added `checkForDuplicateDomainObjectName()` in `aggregate-tools.ts`
- Integrated checks into all domain object creation functions
