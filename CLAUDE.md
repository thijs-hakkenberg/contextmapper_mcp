# CLAUDE.md - Context Mapper MCP Server

This file provides guidance for AI assistants (like Claude) using this MCP server to create Domain-Driven Design models.

## Quick Start

```typescript
// 1. Create a model
cml_create_model({ name: "MyDomainModel" })

// 2. Create a context map
cml_create_context_map({ name: "MyContextMap", state: "AS_IS" })

// 3. Create bounded contexts
cml_create_bounded_context({
  name: "OrderManagement",
  domainVisionStatement: "Handles order lifecycle",
  implementationTechnology: "Python, FastAPI"
})

// 4. Create aggregates with ID Value Objects
cml_create_aggregate({ contextName: "OrderManagement", name: "OrderAggregate" })
cml_add_identifier({ contextName: "OrderManagement", aggregateName: "OrderAggregate", name: "OrderId" })

// 5. Add entities referencing the IDs
cml_add_entity({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "Order",
  aggregateRoot: true,
  attributes: [
    { name: "orderId", type: "- OrderId", key: true },
    { name: "status", type: "String" }
  ]
})

// 6. Save the model
cml_save_model({ path: "/path/to/model.cml" })
```

## Critical Rules

### 1. Use Unique Names Across Bounded Contexts

**NEVER** use the same domain object name in multiple bounded contexts.

```typescript
// BAD - Will cause "ambiguous type reference" errors
cml_add_identifier({ contextName: "A2AServer", ..., name: "AgentId" })
cml_add_identifier({ contextName: "DatabricksPlatform", ..., name: "AgentId" })  // ERROR!

// GOOD - Use context-specific prefixes
cml_add_identifier({ contextName: "A2AServer", ..., name: "A2AAgentId" })
cml_add_identifier({ contextName: "DatabricksPlatform", ..., name: "DatabricksAgentId" })
```

### 2. Use ID Value Objects, Not Primitive Strings

**NEVER** use `String` for identifiers.

```typescript
// BAD - Primitive ID
{ name: "orderId", type: "String", key: true }

// GOOD - ID Value Object reference
cml_add_identifier({ ..., name: "OrderId" })  // Creates ValueObject
{ name: "orderId", type: "- OrderId", key: true }  // Reference it
```

### 3. Use Valid Attribute Types Only

**Valid types:**
- Primitives: `String`, `int`, `long`, `float`, `double`, `boolean`, `DateTime`, `BigDecimal`, `UUID`
- Collections: `List<TypeName>`, `Set<TypeName>`
- References: `- TypeName` (reference to Value Object or Entity)
- Domain objects: Any valid identifier name

**Invalid types (will be rejected):**
- `Map<String, Any>` - Use a Value Object instead
- `Any`, `Tuple` - Use specific types
- `Runnable`, `Callbacks` - Implementation details, omit from domain model
- Nested generics: `List<Map<String, Any>>`

```typescript
// BAD - Will be rejected
{ name: "config", type: "Map<String, Any>" }

// GOOD - Create a Value Object
cml_add_value_object({
  name: "Config",
  attributes: [
    { name: "maxRetries", type: "int" },
    { name: "timeout", type: "long" }
  ]
})
{ name: "config", type: "- Config" }
```

### 4. Avoid Reserved Keywords as Domain Object Names

These names **cannot** be used for Entity, ValueObject, Aggregate, etc.:
- `Resource`, `Entity`, `Service`, `Command`, `Event`, `Aggregate`
- `Repository`, `Module`, `Context`, `Process`, `Flow`

```typescript
// BAD - Will be rejected
cml_add_entity({ ..., name: "Resource" })  // ERROR!

// GOOD - Use descriptive names
cml_add_entity({ ..., name: "MCPResource" })
cml_add_entity({ ..., name: "DomainResource" })
```

### 5. Reserved Attribute Names Are Auto-Escaped

These attribute names are automatically escaped with `^`:
- `query`, `path`, `input`, `output`, `result`, `value`
- `name`, `description`, `type`, `state`, `action`, `url`

You don't need to escape them manually - the server handles it.

## Naming Conventions

| Context Type | Prefix | Examples |
|--------------|--------|----------|
| A2A/Protocol | `A2A` | `A2AAgentId`, `A2ATaskId` |
| Databricks | `Databricks` or `DB` | `DatabricksAgentId` |
| ServiceNow | `SNOW` | `SNOWAgentId` |
| Salesforce | `SF` | `SFAgentId`, `SFOrgId` |
| Microsoft | `MS` or `Copilot` | `CopilotBotId` |
| Generic | Domain name | `OrderId`, `CustomerId` |

## Workflow Pattern

1. **Create model and context map**
2. **Create all bounded contexts first**
3. **For each context:**
   - Create aggregate(s)
   - Create ID Value Objects using `cml_add_identifier`
   - Create other Value Objects
   - Create Entities (referencing the IDs)
   - Create Domain Events and Commands
4. **Create relationships between contexts**
5. **Save and validate**

## Validation

The server validates at creation time:
- Duplicate names across contexts
- Invalid attribute types
- Reserved keyword names

Always check the `success` field in responses:

```typescript
const result = cml_add_entity({ ... });
if (!result.success) {
  console.error(result.error);  // Contains helpful suggestion
}
```

## Documentation

See `docs/MODELING_GUIDE.md` for comprehensive documentation with examples.
