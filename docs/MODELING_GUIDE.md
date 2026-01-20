# Context Mapper MCP Server - Modeling Guide

This guide covers best practices for creating Domain-Driven Design models using the Context Mapper MCP Server.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Model Structure](#model-structure)
3. [Creating Identifiers (IDs)](#creating-identifiers-ids)
4. [Unique Naming Across Bounded Contexts](#unique-naming-across-bounded-contexts)
5. [Complete Workflow Example](#complete-workflow-example)
6. [Reserved Keywords](#reserved-keywords)
7. [Valid Attribute Types](#valid-attribute-types)
8. [Tool Reference](#tool-reference)

---

## Quick Start

### Installation

```bash
# Add the MCP server to Claude Code
claude mcp add context-mapper --scope user -- node /path/to/context_mapper_mcp/dist/index.js
```

### Basic Workflow

1. Create a model: `cml_create_model`
2. Create bounded contexts: `cml_create_bounded_context`
3. Create aggregates: `cml_create_aggregate`
4. Add domain elements: entities, value objects, events, commands
5. Define relationships: `cml_create_relationship`
6. Save the model: `cml_save_model`

---

## Model Structure

A CML model follows this hierarchy:

```
Model
├── ContextMap (optional)
│   ├── state (AS_IS | TO_BE)
│   ├── contains [BoundedContext names]
│   └── relationships
│       ├── Partnership
│       ├── SharedKernel
│       └── UpstreamDownstream (with OHS/PL/ACL/CF patterns)
│
└── BoundedContexts[]
    ├── domainVisionStatement
    ├── responsibilities[]
    ├── implementationTechnology
    └── Aggregates[]
        ├── Entities[]
        ├── ValueObjects[]
        ├── DomainEvents[]
        ├── Commands[]
        └── Services[]
```

---

## Creating Identifiers (IDs)

### The Problem with Primitive IDs

Using primitive `String` types for identifiers violates DDD best practices:

```cml
// ❌ Bad - IDE will warn: "primitive-id-detected"
Entity Order {
    aggregateRoot
    String orderId key        // Warning!
    String customerId         // Warning!
}
```

### The Solution: ID Value Objects

Create dedicated Value Objects for each identifier type:

```cml
// ✅ Good - Proper DDD modeling
ValueObject OrderId {
    String value
}

ValueObject CustomerId {
    String value
}

Entity Order {
    aggregateRoot
    - OrderId orderId key     // Reference to Value Object
    - CustomerId customerId   // Reference to Value Object
}
```

### Using the `cml_add_identifier` Tool

The MCP server provides a dedicated tool for creating ID Value Objects:

```typescript
// Creates a Value Object named "OrderId" with a single "value" attribute
cml_add_identifier({
  contextName: "OrderContext",
  aggregateName: "OrderAggregate",
  name: "OrderId"  // or just "Order" - will be normalized to "OrderId"
})

// Returns:
{
  success: true,
  identifier: {
    id: "uuid...",
    name: "OrderId",
    type: "- OrderId"  // Use this in attribute declarations
  }
}
```

### Recommended Workflow for Entities with IDs

1. **First, create the ID Value Objects:**
   ```
   cml_add_identifier(contextName, aggregateName, "Order")
   cml_add_identifier(contextName, aggregateName, "Customer")
   ```

2. **Then, create the entity referencing those IDs:**
   ```
   cml_add_entity({
     contextName: "...",
     aggregateName: "...",
     name: "Order",
     aggregateRoot: true,
     attributes: [
       { name: "orderId", type: "- OrderId", key: true },
       { name: "customerId", type: "- CustomerId" },
       { name: "totalAmount", type: "BigDecimal" }
     ]
   })
   ```

---

## Unique Naming Across Bounded Contexts

### The Ambiguous Type Reference Problem

**CRITICAL**: Domain object names (Value Objects, Entities, Domain Events, Commands) must be **unique across all bounded contexts** in your model. If you use the same name in multiple contexts, CML tools will report an error:

```
The reference to the type 'AgentId' is ambiguous, since there exist
multiple domain objects with that name in your model.
```

### ❌ Bad Example - Duplicate Names

```cml
// This will cause ambiguous type reference errors!

BoundedContext A2AServer {
    Aggregate A2AProtocol {
        ValueObject AgentId {      // ❌ "AgentId" defined here
            String value
        }
    }
}

BoundedContext DatabricksPlatform {
    Aggregate DatabricksAgent {
        ValueObject AgentId {      // ❌ Same name! Ambiguous reference
            String value
        }
    }
}

BoundedContext ServiceNowPlatform {
    Aggregate SNOWAgent {
        ValueObject AgentId {      // ❌ Same name again!
            String value
        }
    }
}
```

### ✅ Good Example - Unique Prefixed Names

Use context-specific prefixes to make names unique:

```cml
BoundedContext A2AServer {
    Aggregate A2AProtocol {
        ValueObject A2AAgentId {           // ✅ Unique: "A2A" prefix
            String value
        }
        ValueObject A2ATaskId {
            String value
        }
    }
}

BoundedContext DatabricksPlatform {
    Aggregate DatabricksAgent {
        ValueObject DatabricksAgentId {    // ✅ Unique: "Databricks" prefix
            String value
        }
        ValueObject MLflowTraceId {
            String value
        }
    }
}

BoundedContext ServiceNowPlatform {
    Aggregate SNOWAgent {
        ValueObject SNOWAgentId {          // ✅ Unique: "SNOW" prefix
            String value
        }
    }
}
```

### Naming Convention Guidelines

| Context | Prefix | Example IDs |
|---------|--------|-------------|
| A2AServer | `A2A` | `A2AAgentId`, `A2ATaskId`, `A2ASkillId` |
| DatabricksPlatform | `Databricks` or `MLflow` | `DatabricksAgentId`, `MLflowTraceId` |
| ServiceNowPlatform | `SNOW` | `SNOWAgentId` |
| SalesforceAgentforce | `SF` | `SFAgentId`, `SFOrgId` |
| CopilotStudioPlatform | `Copilot` | `CopilotBotId`, `CopilotTenantId` |

### Validation

The MCP server **automatically validates** for duplicate domain object names. When you call `cml_validate_model`, it will report errors like:

```json
{
  "valid": false,
  "errors": [
    {
      "type": "error",
      "message": "Ambiguous domain object name 'AgentId' defined in multiple locations: A2AServer.A2AProtocol, DatabricksPlatform.DatabricksAgent. Use unique prefixed names (e.g., 'A2AAgentId', 'DatabricksAgentId') to avoid ambiguous type references."
    }
  ]
}
```

### When Creating IDs with `cml_add_identifier`

Always use context-specific prefixes:

```typescript
// ❌ Bad - will cause duplicates across contexts
cml_add_identifier({ contextName: "A2AServer", aggregateName: "A2AProtocol", name: "AgentId" })
cml_add_identifier({ contextName: "DatabricksPlatform", aggregateName: "DatabricksAgent", name: "AgentId" })

// ✅ Good - unique prefixed names
cml_add_identifier({ contextName: "A2AServer", aggregateName: "A2AProtocol", name: "A2AAgentId" })
cml_add_identifier({ contextName: "DatabricksPlatform", aggregateName: "DatabricksAgent", name: "DatabricksAgentId" })
```

---

## Complete Workflow Example

Here's a complete example creating an Order Management bounded context:

### Step 1: Create the Model

```
cml_create_model({ name: "ECommerceModel" })
```

### Step 2: Create Context Map

```
cml_create_context_map({ name: "ECommerceMap", state: "AS_IS" })
```

### Step 3: Create Bounded Context

```
cml_create_bounded_context({
  name: "OrderManagement",
  domainVisionStatement: "Handles order lifecycle from creation to fulfillment",
  implementationTechnology: "Java, Spring Boot",
  responsibilities: ["Order creation", "Order tracking", "Payment processing"]
})
```

### Step 4: Create Aggregate

```
cml_create_aggregate({
  contextName: "OrderManagement",
  name: "OrderAggregate",
  responsibilities: ["Order state management", "Order validation"]
})
```

### Step 5: Create ID Value Objects

```
cml_add_identifier({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "OrderId"
})

cml_add_identifier({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "CustomerId"
})

cml_add_identifier({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "ProductId"
})
```

### Step 6: Create Entities

```
cml_add_entity({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "Order",
  aggregateRoot: true,
  attributes: [
    { name: "orderId", type: "- OrderId", key: true },
    { name: "customerId", type: "- CustomerId" },
    { name: "orderDate", type: "DateTime" },
    { name: "status", type: "String" }
  ]
})

cml_add_entity({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "OrderLine",
  attributes: [
    { name: "lineId", type: "- OrderLineId", key: true },
    { name: "productId", type: "- ProductId" },
    { name: "quantity", type: "int" },
    { name: "unitPrice", type: "BigDecimal" }
  ]
})
```

### Step 7: Create Value Objects

```
cml_add_value_object({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "Address",
  attributes: [
    { name: "street", type: "String" },
    { name: "city", type: "String" },
    { name: "postalCode", type: "String" },
    { name: "country", type: "String" }
  ]
})

cml_add_value_object({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "Money",
  attributes: [
    { name: "amount", type: "BigDecimal" },
    { name: "currency", type: "String" }
  ]
})
```

### Step 8: Create Domain Events

```
cml_add_domain_event({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "OrderPlaced",
  attributes: [
    { name: "orderId", type: "- OrderId" },
    { name: "customerId", type: "- CustomerId" },
    { name: "placedAt", type: "DateTime" }
  ]
})

cml_add_domain_event({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "OrderShipped",
  attributes: [
    { name: "orderId", type: "- OrderId" },
    { name: "shippedAt", type: "DateTime" },
    { name: "trackingNumber", type: "String" }
  ]
})
```

### Step 9: Create Commands

```
cml_add_command({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "PlaceOrder",
  attributes: [
    { name: "customerId", type: "- CustomerId" },
    { name: "items", type: "List<OrderLineRequest>" }
  ]
})

cml_add_command({
  contextName: "OrderManagement",
  aggregateName: "OrderAggregate",
  name: "CancelOrder",
  attributes: [
    { name: "orderId", type: "- OrderId" },
    { name: "reason", type: "String" }
  ]
})
```

### Step 10: Save the Model

```
cml_save_model({ path: "/path/to/order-model.cml" })
```

### Resulting CML Output

```cml
ContextMap ECommerceMap {
    state = AS_IS
    contains OrderManagement
}

BoundedContext OrderManagement {
    domainVisionStatement = "Handles order lifecycle from creation to fulfillment"
    responsibilities = "Order creation", "Order tracking", "Payment processing"
    implementationTechnology = "Java, Spring Boot"

    Aggregate OrderAggregate {
        responsibilities = "Order state management", "Order validation"

        Entity Order {
            aggregateRoot
            - OrderId orderId key
            - CustomerId customerId
            DateTime orderDate
            String status
        }

        Entity OrderLine {
            - OrderLineId lineId key
            - ProductId productId
            int quantity
            BigDecimal unitPrice
        }

        ValueObject OrderId {
            String value
        }

        ValueObject CustomerId {
            String value
        }

        ValueObject ProductId {
            String value
        }

        ValueObject OrderLineId {
            String value
        }

        ValueObject Address {
            String street
            String city
            String postalCode
            String country
        }

        ValueObject Money {
            BigDecimal amount
            String currency
        }

        DomainEvent OrderPlaced {
            - OrderId orderId
            - CustomerId customerId
            DateTime placedAt
        }

        DomainEvent OrderShipped {
            - OrderId orderId
            DateTime shippedAt
            String trackingNumber
        }

        Command PlaceOrder {
            - CustomerId customerId
            List<OrderLineRequest> items
        }

        Command CancelOrder {
            - OrderId orderId
            String reason
        }
    }
}
```

---

## Reserved Keywords

The following keywords are automatically escaped with `^` when used as attribute names:

| Keywords |
|----------|
| `abstract`, `action`, `aggregate`, `aggregateRoot`, `application`, `assert`, `async` |
| `boundedContext`, `by` |
| `case`, `catch`, `class`, `command`, `contains`, `context` |
| `def`, `default`, `description`, `do`, `domain`, `domainEvent`, `domainVisionStatement` |
| `else`, `entity`, `enum`, `event`, `exposedAggregates`, `extends` |
| `false`, `final`, `finally`, `for`, `function` |
| `gap`, `get` |
| `hint`, `hook` |
| `if`, `implements`, `implementationTechnology`, `import`, `in`, `input`, `instanceof` |
| `key`, `knowledgeLevel` |
| `let`, `list` |
| `map`, `module`, `name` |
| `new`, `null`, `nullable` |
| `of`, `operation`, `optional`, `output` |
| `package`, `param`, `path`, `plateau`, `private`, `protected`, `public` |
| `query` |
| `ref`, `repository`, `required`, `responsibilities`, `result`, `return` |
| `scaffold`, `service`, `set`, `state`, `static`, `subdomain`, `super`, `switch` |
| `this`, `throw`, `trait`, `true`, `try`, `type` |
| `url`, `use` |
| `value`, `valueObject`, `var`, `version`, `void` |
| `while`, `with` |

Example:
```cml
// Input attribute name: "description"
// Output in CML file: "String ^description"
```

---

## Valid Attribute Types

CML has specific rules for attribute types. The MCP server **validates types at creation time** and will reject invalid types with helpful error messages.

### ✅ Valid Types

| Category | Types | Example |
|----------|-------|---------|
| **Strings** | `String`, `string` | `String name` |
| **Integers** | `int`, `Integer`, `long`, `Long`, `short`, `Short`, `byte`, `Byte` | `int quantity` |
| **Decimals** | `float`, `Float`, `double`, `Double`, `BigDecimal`, `BigInteger` | `BigDecimal price` |
| **Booleans** | `boolean`, `Boolean` | `boolean isActive` |
| **Date/Time** | `Date`, `DateTime`, `Timestamp` | `DateTime createdAt` |
| **Binary** | `Blob`, `Clob` | `Blob content` |
| **Other** | `UUID`, `Object`, `char`, `Character` | `UUID id` |
| **Collections** | `List<Type>`, `Set<Type>` | `List<String> tags` |
| **References** | `- TypeName` | `- OrderId orderId` |
| **Domain Objects** | Any valid identifier | `Address shippingAddress` |

### ❌ Invalid Types (Will Be Rejected)

| Invalid Type | Error Message | Solution |
|--------------|---------------|----------|
| `Map<String, Any>` | Map<K,V> is not supported in CML | Create a Value Object with named fields |
| `Any` | Any is not supported in CML | Use a specific type or `Object` |
| `Tuple` | Tuple is not supported in CML | Create a Value Object with named fields |
| `Runnable` | Runnable is not supported | Omit implementation details from domain model |
| `Callbacks` | Callback types are not supported | Model callback contract as Value Object |
| `Function<T>` | Function types are not supported | Model behavior in Services |
| `List<Map<String, Any>>` | Nested generics not supported | Use Value Objects for complex structures |

### Examples

```typescript
// ❌ Bad - Will be rejected
cml_add_entity({
  contextName: "...",
  aggregateName: "...",
  name: "Agent",
  attributes: [
    { name: "config", type: "Map<String, Any>" },     // ERROR!
    { name: "callbacks", type: "Callbacks" },          // ERROR!
    { name: "handler", type: "Runnable" },             // ERROR!
  ]
})

// ✅ Good - Use Value Objects instead
cml_add_value_object({
  contextName: "...",
  aggregateName: "...",
  name: "AgentConfig",
  attributes: [
    { name: "maxIterations", type: "int" },
    { name: "timeout", type: "long" },
    { name: "model", type: "String" }
  ]
})

cml_add_entity({
  contextName: "...",
  aggregateName: "...",
  name: "Agent",
  attributes: [
    { name: "config", type: "- AgentConfig" },        // Reference to Value Object
    { name: "tools", type: "List<Tool>" },            // Collection of domain objects
    { name: "id", type: "- AgentId" }                 // ID Value Object
  ]
})
```

### Modeling Complex Structures

When you need to model complex structures like maps or tuples, convert them to Value Objects:

| Instead of... | Use... |
|---------------|--------|
| `Map<String, Any> metadata` | `ValueObject Metadata { String key1; String key2; ... }` |
| `Tuple<AgentAction, String>` | `ValueObject ActionResult { AgentAction action; String result; }` |
| `List<Tuple<String, Int>>` | `ValueObject NamedValue { String name; int value; }` + `List<NamedValue>` |

---

## Tool Reference

### Model Management
| Tool | Description |
|------|-------------|
| `cml_create_model` | Create a new empty CML model |
| `cml_load_model` | Load a model from a .cml file |
| `cml_save_model` | Save the current model to a file |
| `cml_validate_model` | Validate the current model |
| `cml_get_model_info` | Get information about the current model |

### Context Map
| Tool | Description |
|------|-------------|
| `cml_create_context_map` | Create a context map (AS_IS or TO_BE) |
| `cml_create_relationship` | Create relationships (Partnership, SharedKernel, UpstreamDownstream) |
| `cml_update_relationship` | Update an existing relationship |
| `cml_delete_relationship` | Delete a relationship |

### Bounded Contexts
| Tool | Description |
|------|-------------|
| `cml_create_bounded_context` | Create a new bounded context |
| `cml_update_bounded_context` | Update bounded context properties |
| `cml_delete_bounded_context` | Delete a bounded context |
| `cml_list_bounded_contexts` | List all bounded contexts |
| `cml_get_bounded_context` | Get details of a specific context |

### Aggregates
| Tool | Description |
|------|-------------|
| `cml_create_aggregate` | Create a new aggregate in a context |
| `cml_update_aggregate` | Update aggregate properties |
| `cml_delete_aggregate` | Delete an aggregate |
| `cml_list_aggregates` | List aggregates (optionally filtered by context) |
| `cml_get_aggregate` | Get aggregate details including all elements |

### Domain Elements
| Tool | Description |
|------|-------------|
| `cml_add_entity` | Add an entity to an aggregate |
| `cml_add_value_object` | Add a value object to an aggregate |
| `cml_add_identifier` | Create an ID Value Object (DDD best practice) |
| `cml_add_domain_event` | Add a domain event to an aggregate |
| `cml_add_command` | Add a command to an aggregate |
| `cml_add_service` | Add a domain service to an aggregate |

### Delete Operations
| Tool | Description |
|------|-------------|
| `cml_delete_entity` | Delete an entity |
| `cml_delete_value_object` | Delete a value object |
| `cml_delete_domain_event` | Delete a domain event |
| `cml_delete_command` | Delete a command |
| `cml_delete_service` | Delete a service |

### Query & Search
| Tool | Description |
|------|-------------|
| `cml_find_elements` | Search for elements by name pattern (regex) |
| `cml_list_relationships` | List relationships (optionally filtered) |

### Diagram Generation
| Tool | Description |
|------|-------------|
| `cml_generate_context_map_diagram` | Generate PlantUML context map |
| `cml_generate_aggregate_diagram` | Generate PlantUML class diagram for aggregate |
| `cml_generate_full_diagram` | Generate complete PlantUML diagram |

---

## Tips & Best Practices

1. **Always use ID Value Objects** - Use `cml_add_identifier` before creating entities that need IDs

2. **Create IDs first** - Create all your ID Value Objects at the start of aggregate creation

3. **Use reference syntax** - When referencing Value Objects in attributes, use `- TypeName` syntax

4. **Meaningful names** - Use descriptive names that reflect the domain language

5. **Validate often** - Use `cml_validate_model` to check for issues before saving

6. **Context Map state** - Use `AS_IS` for current architecture, `TO_BE` for target architecture

7. **Relationship patterns**:
   - `OHS` (Open Host Service) - upstream exposes a well-defined API
   - `PL` (Published Language) - shared language/schema between contexts
   - `ACL` (Anti-Corruption Layer) - downstream translates/protects from upstream
   - `CF` (Conformist) - downstream conforms to upstream model
