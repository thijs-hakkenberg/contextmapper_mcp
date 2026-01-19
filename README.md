# Context Mapper MCP Server

An MCP (Model Context Protocol) server that enables AI assistants to work with Domain-Driven Design models using Context Mapper's CML (Context Mapping Language).

## Features

- **Parse and serialize CML files** - Full support for Context Mapper's CML syntax
- **Manage bounded contexts** - Create, update, delete bounded contexts
- **Work with aggregates** - Define entities, value objects, domain events, commands, and services
- **Context map relationships** - Define and manage relationships between bounded contexts (Partnership, SharedKernel, Upstream-Downstream with patterns like OHS, PL, ACL, CF)
- **Generate PlantUML diagrams** - Visualize context maps and aggregate structures

## Installation

```bash
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
      "command": "node",
      "args": ["/path/to/context_mapper_mcp/dist/index.js"]
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
| `cml_add_domain_event` | Add domain event |
| `cml_add_command` | Add command |
| `cml_add_service` | Add domain service |
| `cml_delete_entity` | Delete entity |
| `cml_delete_value_object` | Delete value object |
| `cml_delete_domain_event` | Delete domain event |
| `cml_delete_command` | Delete command |
| `cml_delete_service` | Delete service |

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
node test-run.mjs
```

## Architecture

- **Parser**: Chevrotain-based lexer and parser for CML syntax
- **Writer**: Serializes model back to CML format
- **Validation**: Checks model consistency and semantic rules
- **Tools**: MCP tool implementations for all operations
- **Generators**: PlantUML diagram generators

## License

MIT
