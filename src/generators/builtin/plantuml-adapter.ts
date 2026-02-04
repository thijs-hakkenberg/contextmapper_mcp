/**
 * PlantUML Adapter
 * Wraps the existing PlantUML generator to implement the IGenerator interface
 */

import type { CMLModel, Aggregate } from '../../model/types.js';
import type {
  IGenerator,
  GeneratorResult,
  GeneratorOptions,
  GeneratorOutput,
} from '../interfaces.js';
import { createSuccessResult, createErrorResult } from '../interfaces.js';
import {
  generateContextMapDiagram,
  generateAggregateDiagram,
  generateFullModelDiagram,
} from '../plantuml.js';

/**
 * Options for PlantUML Context Map generator
 */
export interface PlantUMLContextMapOptions extends GeneratorOptions {
  /** Include aggregates in the diagram */
  includeAggregates?: boolean;
}

/**
 * Options for PlantUML Aggregate generator
 */
export interface PlantUMLAggregateOptions extends GeneratorOptions {
  /** Name of the bounded context */
  contextName: string;
  /** Name of the aggregate */
  aggregateName: string;
}

/**
 * PlantUML Context Map Generator
 * Generates PlantUML syntax for context map diagrams
 */
export class PlantUMLContextMapGenerator implements IGenerator {
  name = 'plantuml-context-map';
  description = 'Generate PlantUML context map diagram showing bounded contexts and relationships';
  requiresCLI = false;
  outputFormats = ['plantuml'];

  async generate(model: CMLModel, options?: PlantUMLContextMapOptions): Promise<GeneratorResult> {
    try {
      const includeAggregates = options?.includeAggregates ?? false;
      const plantuml = generateContextMapDiagram(model, includeAggregates);

      const output: GeneratorOutput = {
        type: 'content',
        content: plantuml,
        format: 'plantuml',
        description: 'Context map diagram in PlantUML format',
      };

      return createSuccessResult([output]);
    } catch (error) {
      return createErrorResult(
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error generating context map diagram'
      );
    }
  }
}

/**
 * PlantUML Aggregate Generator
 * Generates PlantUML syntax for aggregate class diagrams
 */
export class PlantUMLAggregateGenerator implements IGenerator {
  name = 'plantuml-aggregate';
  description = 'Generate PlantUML class diagram for a specific aggregate';
  requiresCLI = false;
  outputFormats = ['plantuml'];

  async generate(model: CMLModel, options?: PlantUMLAggregateOptions): Promise<GeneratorResult> {
    if (!options?.contextName) {
      return createErrorResult(
        'INTERNAL_ERROR',
        'contextName is required',
        'Provide the name of the bounded context containing the aggregate'
      );
    }

    if (!options?.aggregateName) {
      return createErrorResult(
        'INTERNAL_ERROR',
        'aggregateName is required',
        'Provide the name of the aggregate to generate the diagram for'
      );
    }

    try {
      // Find the bounded context
      const bc = model.boundedContexts.find((c) => c.name === options.contextName);
      if (!bc) {
        return createErrorResult(
          'INTERNAL_ERROR',
          `Bounded context '${options.contextName}' not found`
        );
      }

      // Find the aggregate
      let aggregate: Aggregate | undefined = bc.aggregates.find(
        (a) => a.name === options.aggregateName
      );

      // Also check modules
      if (!aggregate) {
        for (const mod of bc.modules) {
          const found = mod.aggregates.find((a) => a.name === options.aggregateName);
          if (found) {
            aggregate = found;
            break;
          }
        }
      }

      if (!aggregate) {
        return createErrorResult(
          'INTERNAL_ERROR',
          `Aggregate '${options.aggregateName}' not found in context '${options.contextName}'`
        );
      }

      const plantuml = generateAggregateDiagram(aggregate);

      const output: GeneratorOutput = {
        type: 'content',
        content: plantuml,
        format: 'plantuml',
        description: `Class diagram for aggregate '${options.aggregateName}'`,
      };

      return createSuccessResult([output]);
    } catch (error) {
      return createErrorResult(
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error generating aggregate diagram'
      );
    }
  }
}

/**
 * PlantUML Full Model Generator
 * Generates PlantUML syntax for the complete domain model
 */
export class PlantUMLFullModelGenerator implements IGenerator {
  name = 'plantuml-full-model';
  description = 'Generate PlantUML diagram of the complete domain model';
  requiresCLI = false;
  outputFormats = ['plantuml'];

  async generate(model: CMLModel, options?: GeneratorOptions): Promise<GeneratorResult> {
    try {
      const plantuml = generateFullModelDiagram(model);

      const output: GeneratorOutput = {
        type: 'content',
        content: plantuml,
        format: 'plantuml',
        description: 'Full domain model diagram in PlantUML format',
      };

      return createSuccessResult([output]);
    } catch (error) {
      return createErrorResult(
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error generating full model diagram'
      );
    }
  }
}

/**
 * Create all PlantUML generators
 */
export function createPlantUMLGenerators(): IGenerator[] {
  return [
    new PlantUMLContextMapGenerator(),
    new PlantUMLAggregateGenerator(),
    new PlantUMLFullModelGenerator(),
  ];
}
