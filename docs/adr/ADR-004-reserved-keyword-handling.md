# ADR-004: Reserved Keyword Handling

## Status
Accepted

## Date
2025-01-21

## Context
CML has two categories of reserved keywords that cause problems:

### Category 1: Attribute Names
Common attribute names like `query`, `path`, `value`, `type`, `name` are reserved keywords in CML. Using them without escaping causes syntax errors.

### Category 2: Domain Object Names
Structural keywords like `Resource`, `Entity`, `Service`, `Command` cannot be used as domain object names at all, even with escaping.

AI assistants frequently use these names because they are natural domain terms:
- `Resource` for API resources
- `query` for query parameters
- `path` for URL paths

## Decision

### Attribute Names: Auto-Escape
Reserved attribute names are automatically escaped with the `^` prefix during serialization:
- `query` becomes `^query` in CML output
- `path` becomes `^path` in CML output

This is transparent to the user - they can use natural names in the API.

### Domain Object Names: Reject with Suggestions
Reserved domain object names are rejected at creation time with helpful suggestions:

| Reserved Name | Suggested Alternatives |
|---------------|----------------------|
| `Resource` | `MCPResource`, `DomainResource`, `ResourceDefinition` |
| `Entity` | `DomainEntity`, or a more specific name |
| `Service` | `DomainService`, `ApplicationService` |
| `Event` | `DomainEvent`, or a more specific event name |

## Consequences

### Positive
- Natural attribute names work without manual escaping
- Clear guidance when domain object names conflict with keywords
- Models remain valid CML syntax
- Error messages are actionable and include alternatives

### Negative
- Some natural domain names require alternatives (e.g., `Resource`)
- Two different handling strategies may cause confusion
- Need to maintain keyword lists as CML evolves

## Implementation

### Attribute Escaping (writer.ts)
```typescript
const RESERVED_KEYWORDS = new Set([
  'query', 'path', 'value', 'type', 'name', 'input', 'output', 'result',
  // ... many more
]);

private escapeIdentifier(name: string): string {
  if (RESERVED_KEYWORDS.has(name.toLowerCase())) {
    return `^${name}`;
  }
  return name;
}
```

### Domain Object Rejection (validation.ts)
```typescript
const RESERVED_DOMAIN_OBJECT_NAMES = new Set([
  'resource', 'entity', 'service', 'command', 'aggregate',
  // ... structural keywords
]);

export function isReservedDomainObjectName(name: string): {
  isReserved: boolean;
  suggestion?: string;
}
```
