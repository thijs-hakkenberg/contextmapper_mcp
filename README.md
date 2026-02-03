# Context Mapper MCP Server

[![npm version](https://img.shields.io/npm/v/context-mapper-mcp.svg)](https://www.npmjs.com/package/context-mapper-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server that enables AI assistants to work with Domain-Driven Design models using Context Mapper's CML (Context Mapping Language).

## Features

- **Parse and serialize CML files** - Full support for Context Mapper's CML syntax
- **Manage bounded contexts** - Create, update, delete bounded contexts
- **Work with aggregates** - Define entities, value objects, domain events, commands, and services
- **Context map relationships** - Define and manage relationships between bounded contexts (Partnership, SharedKernel, Upstream-Downstream with patterns like OHS, PL, ACL, CF)
- **Generate PlantUML diagrams** - Visualize context maps and aggregate structures
- **Real-time validation** - Catch errors at creation time, not at save time
- **ID Value Objects** - Dedicated tool for creating DDD-compliant identifier types

## Validation Features

The server validates models in real-time to prevent common CML errors:

| Validation | When | Example Error |
|------------|------|---------------|
| Duplicate names | On create | `'AgentId' already exists in ContextA...` |
| Invalid types | On create | `Map<K,V> is not supported in CML...` |
| Reserved names | On create | `'Resource' is a reserved keyword...` |
| Reserved attributes | On save | Auto-escaped with `^` prefix |

### Valid Attribute Types

- **Primitives**: `String`, `int`, `long`, `boolean`, `DateTime`, `BigDecimal`, `UUID`
- **Collections**: `List<Type>`, `Set<Type>`
- **References**: `- TypeName` (reference to domain objects)

### Invalid Types (Rejected)

- `Map<K,V>`, `Any`, `Tuple`, `Runnable`, `Callbacks`, nested generics

## Installation

### Using npx (recommended)

No installation required - run directly with npx:

```bash
npx context-mapper-mcp
```

### Global installation

```bash
npm install -g context-mapper-mcp
context-mapper-mcp
```

### From source

```bash
git clone https://github.com/thijs-hakkenberg/contextmapper_mcp.git
cd contextmapper_mcp
npm install
npm run build
```

## Usage

### As MCP Server

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "context-mapper": {
      "command": "npx",
      "args": ["context-mapper-mcp"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "context-mapper": {
      "command": "context-mapper-mcp"
    }
  }
}
```

### Available Tools

#### Model Management
| Tool | Description |
|------|-------------|
| `cml_create_model` | Create a new empty CML model |
| `cml_load_model` | Load a CML file |
| `cml_save_model` | Save model to disk |
| `cml_validate_model` | Validate CML syntax and semantics |
| `cml_get_model_info` | Get model statistics |

#### Query Tools
| Tool | Description |
|------|-------------|
| `cml_list_bounded_contexts` | List all bounded contexts |
| `cml_get_bounded_context` | Get context details |
| `cml_list_aggregates` | List aggregates (optionally filtered by context) |
| `cml_get_aggregate` | Get aggregate with all its elements |
| `cml_find_elements` | Search by name pattern (regex) |
| `cml_list_relationships` | List context map relationships |

#### Context Tools
| Tool | Description |
|------|-------------|
| `cml_create_context_map` | Create a context map |
| `cml_create_bounded_context` | Create a bounded context |
| `cml_update_bounded_context` | Update a bounded context |
| `cml_delete_bounded_context` | Delete a bounded context |

#### Aggregate Tools
| Tool | Description |
|------|-------------|
| `cml_create_aggregate` | Create an aggregate |
| `cml_update_aggregate` | Update an aggregate |
| `cml_delete_aggregate` | Delete an aggregate |
| `cml_add_entity` | Add entity to aggregate |
| `cml_add_value_object` | Add value object |
| `cml_add_identifier` | Add ID value object (DDD best practice) |
| `cml_add_domain_event` | Add domain event |
| `cml_add_command` | Add command |
| `cml_add_service` | Add domain service |
| `cml_batch_add_elements` | **Batch create** multiple domain objects in one call |
| `cml_delete_entity` | Delete entity |
| `cml_delete_value_object` | Delete value object |
| `cml_delete_domain_event` | Delete domain event |
| `cml_delete_command` | Delete command |
| `cml_delete_service` | Delete service |

##### Batch Creation (`cml_batch_add_elements`)

Create multiple domain objects in a single call for improved efficiency:

```json
{
  "contextName": "CustomerManagement",
  "aggregateName": "Customer",
  "identifiers": [
    { "name": "CustomerId" }
  ],
  "entities": [
    {
      "name": "Customer",
      "aggregateRoot": true,
      "attributes": [
        { "name": "id", "type": "- CustomerId", "key": true },
        { "name": "email", "type": "String" }
      ]
    }
  ],
  "valueObjects": [
    {
      "name": "Address",
      "attributes": [
        { "name": "street", "type": "String" },
        { "name": "city", "type": "String" }
      ]
    }
  ],
  "domainEvents": [
    { "name": "CustomerRegistered", "attributes": [{ "name": "customerId", "type": "- CustomerId" }] }
  ],
  "commands": [
    { "name": "RegisterCustomer", "attributes": [{ "name": "email", "type": "String" }] }
  ]
}
```

**Benefits:**
- **Faster**: Single round-trip instead of 8+ individual calls
- **Atomic validation**: All elements validated before any are created
- **Error handling**: Use `failFast: false` to collect all errors at once

#### Relationship Tools
| Tool | Description |
|------|-------------|
| `cml_create_relationship` | Create context map relationship |
| `cml_update_relationship` | Update relationship |
| `cml_delete_relationship` | Delete relationship |
| `cml_get_relationship` | Get relationship details |

Supported relationship types:
- **Partnership** - Symmetric, both contexts cooperate
- **SharedKernel** - Symmetric, shared code/models
- **UpstreamDownstream** - Asymmetric with patterns:
  - Upstream: OHS (Open Host Service), PL (Published Language)
  - Downstream: ACL (Anticorruption Layer), CF (Conformist)

#### Generation Tools
| Tool | Description |
|------|-------------|
| `cml_generate_context_map_diagram` | Generate PlantUML context map |
| `cml_generate_aggregate_diagram` | Generate aggregate class diagram |
| `cml_generate_full_diagram` | Generate full model diagram |

## Example CML File

```cml
ContextMap ECommerceContextMap {
    type = AS_IS
    contains CustomerManagement, OrderManagement, Inventory

    CustomerManagement [U,OHS,PL] -> [D,ACL] OrderManagement
    OrderManagement [U] -> [D,CF] Inventory
}

BoundedContext CustomerManagement {
    domainVisionStatement = "Manages customer data"
    implementationTechnology = "TypeScript"

    Aggregate Customer {
        Entity Customer {
            aggregateRoot
            key String customerId
            String email
            String firstName
        }

        ValueObject Address {
            String street
            String city
        }

        DomainEvent CustomerRegistered {
            String customerId
            Date registeredAt
        }

        Command RegisterCustomer {
            String email
            String firstName
        }
    }
}
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test
```

## Architecture

- **Parser**: Chevrotain-based lexer and parser for CML syntax
- **Writer**: Serializes model back to CML format
- **Validation**: Checks model consistency and semantic rules
- **Tools**: MCP tool implementations for all operations
- **Generators**: PlantUML diagram generators

## License

MIT
