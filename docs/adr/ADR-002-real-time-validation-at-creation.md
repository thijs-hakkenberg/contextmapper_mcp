# ADR-002: Real-Time Validation at Creation Time

## Status
Accepted

## Date
2025-01-21

## Context
Traditional validation approaches in modeling tools follow this pattern:
1. User creates elements freely
2. User explicitly calls "validate" command
3. Errors are reported all at once

This approach has problems when used by AI assistants:
- AI assistants may create many invalid elements before discovering the errors
- Fixing errors after the fact requires more context and effort
- The AI assistant may not know to call validate until significant work is done

## Decision
We will validate domain objects at creation time, providing immediate feedback before the object is added to the model. This applies to:

1. **Duplicate names**: Check if the name already exists in any bounded context
2. **Invalid attribute types**: Validate all attribute types against CML's type system
3. **Reserved keywords**: Reject domain object names that are CML reserved keywords

When validation fails, the object is NOT created and an error message is returned with:
- Clear explanation of why the creation failed
- Suggestions for how to fix the issue
- Examples of valid alternatives

## Consequences

### Positive
- Immediate feedback prevents accumulation of errors
- AI assistants can correct mistakes in the same turn
- Models are always in a valid state
- Better developer experience with clear, actionable error messages

### Negative
- Slightly slower creation operations due to validation overhead
- Cannot create "draft" or "incomplete" models that violate rules
- All validation rules must be well-defined and documented

## Implementation
- All `add*` functions in `aggregate-tools.ts` run validation before mutation
- Validation functions return `{ success: boolean, error?: string }` pattern
- Error messages include suggestions following the format: `'name' is invalid because X. Try: Y`
