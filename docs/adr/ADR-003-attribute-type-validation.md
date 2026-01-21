# ADR-003: Attribute Type Validation

## Status
Accepted

## Date
2025-01-21

## Context
CML has a specific type system that differs from general-purpose programming languages. When modeling domain objects, users (especially AI assistants) often attempt to use types that are common in programming but not supported by CML:

- `Map<String, Any>` - Generic map types
- `Any` or `dynamic` - Untyped values
- `Tuple<A, B>` - Tuple types
- `Runnable`, `Callback` - Behavioral types
- Nested generics like `List<Map<String, String>>`

Using these types causes CML parsing errors that are cryptic and don't explain why the type is invalid.

## Decision
We will validate attribute types at creation time against CML's supported type system:

### Valid Types
| Category | Types |
|----------|-------|
| Primitives | `String`, `int`, `long`, `boolean`, `DateTime`, `BigDecimal`, `UUID` |
| Collections | `List<Type>`, `Set<Type>` |
| References | `- TypeName` (explicit reference), or just `TypeName` (domain object) |

### Invalid Types (Rejected with Suggestions)
| Invalid Type | Suggestion |
|--------------|------------|
| `Map<K,V>` | Use a Value Object with named fields |
| `Any`, `dynamic` | Use a specific type or `Object` |
| `Tuple<A,B>` | Use a Value Object with named fields |
| `Runnable`, `Callback` | Model behavior in Services instead |
| Nested generics | Use a Value Object to wrap complex structures |

## Consequences

### Positive
- Clear error messages explain why a type is invalid
- Suggestions guide users to CML-compatible alternatives
- Models always use valid CML syntax
- Prevents "works in code, fails in CML" surprises

### Negative
- Less flexibility in type definitions
- May require more Value Objects to model complex structures
- Some implementation details cannot be directly modeled

## Implementation
- Added `VALID_PRIMITIVE_TYPES` set in `validation.ts`
- Added `INVALID_TYPE_PATTERNS` with regex patterns and error messages
- Added `validateAttributeType()` and `validateAttributes()` functions
- Integrated validation into all element creation functions
