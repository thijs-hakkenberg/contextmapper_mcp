#!/usr/bin/env node
/**
 * Context Mapper MCP Server
 * Provides tools for working with Domain-Driven Design models using Context Mapper's CML
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Import tools
import {
  createModel,
  loadModel,
  saveModel,
  validateCurrentModel,
  getModelInfo,
} from './tools/model-tools.js';
import {
  listBoundedContexts,
  getBoundedContext,
  listAggregates,
  getAggregate,
  findElements,
  listRelationships,
} from './tools/query-tools.js';
import {
  createBoundedContext,
  updateBoundedContext,
  deleteBoundedContext,
  createContextMap,
} from './tools/context-tools.js';
import {
  createAggregate,
  updateAggregate,
  deleteAggregate,
  addEntity,
  addValueObject,
  addDomainEvent,
  addCommand,
  addService,
  deleteEntity,
  deleteValueObject,
  deleteDomainEvent,
  deleteCommand,
  deleteService,
} from './tools/aggregate-tools.js';
import {
  createRelationship,
  updateRelationship,
  deleteRelationship,
  getRelationship,
} from './tools/relationship-tools.js';
import {
  generateContextMapDiagramTool,
  generateAggregateDiagramTool,
  generateFullDiagramTool,
} from './tools/generation-tools.js';

// Tool definitions
const tools: Tool[] = [
  // Model Management Tools
  {
    name: 'cml_create_model',
    description: 'Create a new empty CML model',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the model' },
      },
      required: ['name'],
    },
  },
  {
    name: 'cml_load_model',
    description: 'Load a CML model from a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the .cml file' },
      },
      required: ['path'],
    },
  },
  {
    name: 'cml_save_model',
    description: 'Save the current model to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to save the model (optional, uses loaded path if not specified)' },
      },
    },
  },
  {
    name: 'cml_validate_model',
    description: 'Validate the current CML model',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cml_get_model_info',
    description: 'Get information about the current model',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // Query Tools
  {
    name: 'cml_list_bounded_contexts',
    description: 'List all bounded contexts in the model',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cml_get_bounded_context',
    description: 'Get detailed information about a bounded context',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the bounded context' },
      },
      required: ['name'],
    },
  },
  {
    name: 'cml_list_aggregates',
    description: 'List all aggregates, optionally filtered by context',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Optional context name to filter by' },
      },
    },
  },
  {
    name: 'cml_get_aggregate',
    description: 'Get detailed information about an aggregate including entities, value objects, events, and commands',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
      },
      required: ['contextName', 'aggregateName'],
    },
  },
  {
    name: 'cml_find_elements',
    description: 'Search for elements by name pattern (regex supported)',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Search pattern (regex)' },
        elementType: {
          type: 'string',
          enum: ['BoundedContext', 'Aggregate', 'Entity', 'ValueObject', 'DomainEvent', 'Command', 'Service'],
          description: 'Optional element type filter',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'cml_list_relationships',
    description: 'List context map relationships',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Optional context name to filter relationships involving this context' },
      },
    },
  },

  // Context Tools
  {
    name: 'cml_create_context_map',
    description: 'Create a context map for the model',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the context map' },
        state: { type: 'string', enum: ['AS_IS', 'TO_BE'], description: 'State of the context map' },
      },
    },
  },
  {
    name: 'cml_create_bounded_context',
    description: 'Create a new bounded context',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the bounded context' },
        domainVisionStatement: { type: 'string', description: 'Domain vision statement' },
        responsibilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of responsibilities',
        },
        implementationTechnology: { type: 'string', description: 'Implementation technology (e.g., Java, TypeScript)' },
        knowledgeLevel: { type: 'string', enum: ['META', 'CONCRETE'], description: 'Knowledge level' },
      },
      required: ['name'],
    },
  },
  {
    name: 'cml_update_bounded_context',
    description: 'Update a bounded context',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Current name of the bounded context' },
        newName: { type: 'string', description: 'New name for the context' },
        domainVisionStatement: { type: 'string', description: 'Domain vision statement' },
        responsibilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of responsibilities',
        },
        implementationTechnology: { type: 'string', description: 'Implementation technology' },
        knowledgeLevel: { type: 'string', enum: ['META', 'CONCRETE'], description: 'Knowledge level' },
      },
      required: ['name'],
    },
  },
  {
    name: 'cml_delete_bounded_context',
    description: 'Delete a bounded context and its relationships',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the bounded context to delete' },
      },
      required: ['name'],
    },
  },

  // Aggregate Tools
  {
    name: 'cml_create_aggregate',
    description: 'Create a new aggregate in a bounded context',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        name: { type: 'string', description: 'Name of the aggregate' },
        responsibilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of responsibilities',
        },
        knowledgeLevel: { type: 'string', enum: ['META', 'CONCRETE'], description: 'Knowledge level' },
      },
      required: ['contextName', 'name'],
    },
  },
  {
    name: 'cml_update_aggregate',
    description: 'Update an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Current name of the aggregate' },
        newName: { type: 'string', description: 'New name for the aggregate' },
        responsibilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of responsibilities',
        },
        knowledgeLevel: { type: 'string', enum: ['META', 'CONCRETE'], description: 'Knowledge level' },
      },
      required: ['contextName', 'aggregateName'],
    },
  },
  {
    name: 'cml_delete_aggregate',
    description: 'Delete an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate to delete' },
      },
      required: ['contextName', 'aggregateName'],
    },
  },
  {
    name: 'cml_add_entity',
    description: 'Add an entity to an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
        name: { type: 'string', description: 'Name of the entity' },
        aggregateRoot: { type: 'boolean', description: 'Whether this is the aggregate root' },
        attributes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              key: { type: 'boolean' },
              nullable: { type: 'boolean' },
            },
            required: ['name', 'type'],
          },
          description: 'Entity attributes',
        },
      },
      required: ['contextName', 'aggregateName', 'name'],
    },
  },
  {
    name: 'cml_add_value_object',
    description: 'Add a value object to an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
        name: { type: 'string', description: 'Name of the value object' },
        attributes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['name', 'type'],
          },
          description: 'Value object attributes',
        },
      },
      required: ['contextName', 'aggregateName', 'name'],
    },
  },
  {
    name: 'cml_add_domain_event',
    description: 'Add a domain event to an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
        name: { type: 'string', description: 'Name of the domain event' },
        attributes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['name', 'type'],
          },
          description: 'Event attributes',
        },
      },
      required: ['contextName', 'aggregateName', 'name'],
    },
  },
  {
    name: 'cml_add_command',
    description: 'Add a command to an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
        name: { type: 'string', description: 'Name of the command' },
        attributes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['name', 'type'],
          },
          description: 'Command attributes',
        },
      },
      required: ['contextName', 'aggregateName', 'name'],
    },
  },
  {
    name: 'cml_add_service',
    description: 'Add a domain service to an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
        name: { type: 'string', description: 'Name of the service' },
        operations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              returnType: { type: 'string' },
              parameters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                  },
                  required: ['name', 'type'],
                },
              },
            },
            required: ['name'],
          },
          description: 'Service operations',
        },
      },
      required: ['contextName', 'aggregateName', 'name'],
    },
  },
  {
    name: 'cml_delete_entity',
    description: 'Delete an entity from an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
        entityName: { type: 'string', description: 'Name of the entity to delete' },
      },
      required: ['contextName', 'aggregateName', 'entityName'],
    },
  },
  {
    name: 'cml_delete_value_object',
    description: 'Delete a value object from an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
        valueObjectName: { type: 'string', description: 'Name of the value object to delete' },
      },
      required: ['contextName', 'aggregateName', 'valueObjectName'],
    },
  },
  {
    name: 'cml_delete_domain_event',
    description: 'Delete a domain event from an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
        eventName: { type: 'string', description: 'Name of the domain event to delete' },
      },
      required: ['contextName', 'aggregateName', 'eventName'],
    },
  },
  {
    name: 'cml_delete_command',
    description: 'Delete a command from an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
        commandName: { type: 'string', description: 'Name of the command to delete' },
      },
      required: ['contextName', 'aggregateName', 'commandName'],
    },
  },
  {
    name: 'cml_delete_service',
    description: 'Delete a service from an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
        serviceName: { type: 'string', description: 'Name of the service to delete' },
      },
      required: ['contextName', 'aggregateName', 'serviceName'],
    },
  },

  // Relationship Tools
  {
    name: 'cml_create_relationship',
    description: 'Create a relationship between bounded contexts. Types: Partnership, SharedKernel (symmetric), UpstreamDownstream (asymmetric with optional OHS/PL upstream patterns and ACL/CF downstream patterns)',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['Partnership', 'SharedKernel', 'UpstreamDownstream'],
          description: 'Type of relationship',
        },
        participant1: { type: 'string', description: 'First participant (for symmetric relationships)' },
        participant2: { type: 'string', description: 'Second participant (for symmetric relationships)' },
        upstream: { type: 'string', description: 'Upstream context (for UpstreamDownstream)' },
        downstream: { type: 'string', description: 'Downstream context (for UpstreamDownstream)' },
        upstreamPatterns: {
          type: 'array',
          items: { type: 'string', enum: ['OHS', 'PL'] },
          description: 'Upstream patterns: OHS (Open Host Service), PL (Published Language)',
        },
        downstreamPatterns: {
          type: 'array',
          items: { type: 'string', enum: ['ACL', 'CF'] },
          description: 'Downstream patterns: ACL (Anticorruption Layer), CF (Conformist)',
        },
        exposedAggregates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Aggregates exposed by the upstream context',
        },
        name: { type: 'string', description: 'Optional name for the relationship' },
      },
      required: ['type'],
    },
  },
  {
    name: 'cml_update_relationship',
    description: 'Update a relationship',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the relationship to update' },
        upstreamPatterns: {
          type: 'array',
          items: { type: 'string', enum: ['OHS', 'PL'] },
          description: 'Upstream patterns',
        },
        downstreamPatterns: {
          type: 'array',
          items: { type: 'string', enum: ['ACL', 'CF'] },
          description: 'Downstream patterns',
        },
        exposedAggregates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Aggregates exposed by the upstream context',
        },
        name: { type: 'string', description: 'Name for the relationship' },
      },
      required: ['id'],
    },
  },
  {
    name: 'cml_delete_relationship',
    description: 'Delete a relationship',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the relationship to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'cml_get_relationship',
    description: 'Get details of a specific relationship',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the relationship' },
      },
      required: ['id'],
    },
  },

  // Generation Tools
  {
    name: 'cml_generate_context_map_diagram',
    description: 'Generate a PlantUML context map diagram',
    inputSchema: {
      type: 'object',
      properties: {
        includeAggregates: { type: 'boolean', description: 'Include aggregates in the diagram' },
      },
    },
  },
  {
    name: 'cml_generate_aggregate_diagram',
    description: 'Generate a PlantUML class diagram for an aggregate',
    inputSchema: {
      type: 'object',
      properties: {
        contextName: { type: 'string', description: 'Name of the bounded context' },
        aggregateName: { type: 'string', description: 'Name of the aggregate' },
      },
      required: ['contextName', 'aggregateName'],
    },
  },
  {
    name: 'cml_generate_full_diagram',
    description: 'Generate a PlantUML diagram of the full domain model',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: 'context-mapper-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle call tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Model Management
      case 'cml_create_model':
        result = createModel(args as any);
        break;
      case 'cml_load_model':
        result = await loadModel(args as any);
        break;
      case 'cml_save_model':
        result = await saveModel(args as any);
        break;
      case 'cml_validate_model':
        result = validateCurrentModel();
        break;
      case 'cml_get_model_info':
        result = getModelInfo();
        break;

      // Query Tools
      case 'cml_list_bounded_contexts':
        result = listBoundedContexts();
        break;
      case 'cml_get_bounded_context':
        result = getBoundedContext(args as any);
        break;
      case 'cml_list_aggregates':
        result = listAggregates(args as any);
        break;
      case 'cml_get_aggregate':
        result = getAggregate(args as any);
        break;
      case 'cml_find_elements':
        result = findElements(args as any);
        break;
      case 'cml_list_relationships':
        result = listRelationships(args as any);
        break;

      // Context Tools
      case 'cml_create_context_map':
        result = createContextMap(args as any);
        break;
      case 'cml_create_bounded_context':
        result = createBoundedContext(args as any);
        break;
      case 'cml_update_bounded_context':
        result = updateBoundedContext(args as any);
        break;
      case 'cml_delete_bounded_context':
        result = deleteBoundedContext(args as any);
        break;

      // Aggregate Tools
      case 'cml_create_aggregate':
        result = createAggregate(args as any);
        break;
      case 'cml_update_aggregate':
        result = updateAggregate(args as any);
        break;
      case 'cml_delete_aggregate':
        result = deleteAggregate(args as any);
        break;
      case 'cml_add_entity':
        result = addEntity(args as any);
        break;
      case 'cml_add_value_object':
        result = addValueObject(args as any);
        break;
      case 'cml_add_domain_event':
        result = addDomainEvent(args as any);
        break;
      case 'cml_add_command':
        result = addCommand(args as any);
        break;
      case 'cml_add_service':
        result = addService(args as any);
        break;
      case 'cml_delete_entity':
        result = deleteEntity(args as any);
        break;
      case 'cml_delete_value_object':
        result = deleteValueObject(args as any);
        break;
      case 'cml_delete_domain_event':
        result = deleteDomainEvent(args as any);
        break;
      case 'cml_delete_command':
        result = deleteCommand(args as any);
        break;
      case 'cml_delete_service':
        result = deleteService(args as any);
        break;

      // Relationship Tools
      case 'cml_create_relationship':
        result = createRelationship(args as any);
        break;
      case 'cml_update_relationship':
        result = updateRelationship(args as any);
        break;
      case 'cml_delete_relationship':
        result = deleteRelationship(args as any);
        break;
      case 'cml_get_relationship':
        result = getRelationship(args as any);
        break;

      // Generation Tools
      case 'cml_generate_context_map_diagram':
        result = generateContextMapDiagramTool(args as any);
        break;
      case 'cml_generate_aggregate_diagram':
        result = generateAggregateDiagramTool(args as any);
        break;
      case 'cml_generate_full_diagram':
        result = generateFullDiagramTool();
        break;

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Context Mapper MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
