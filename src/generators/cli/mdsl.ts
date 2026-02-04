/**
 * MDSL CLI Generator
 * Generates MDSL (Microservice Domain Specific Language) contracts using the Context Mapper CLI
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';

import type { CMLModel } from '../../model/types.js';
import type {
  IGenerator,
  GeneratorResult,
  MDSLGeneratorOptions,
  GeneratorOutput,
} from '../interfaces.js';
import {
  createSuccessResult,
  createErrorResult,
  cliNotFoundError,
  javaNotFoundError,
  javaVersionError,
  executionTimeoutError,
} from '../interfaces.js';
import { serializeCML } from '../../model/writer.js';
import { withTempFiles } from '../../utils/temp-files.js';
import { getCLIExecutor, getCLIStatus } from './executor.js';
import { getCLIConfig } from './config.js';

/**
 * MDSL Generator
 * Uses CLI to generate MDSL microservice contracts from upstream-downstream relationships
 */
export class MDSLGenerator implements IGenerator {
  name = 'mdsl';
  description = 'Generate MDSL microservice contracts from Context Map relationships';
  requiresCLI = true;
  outputFormats = ['mdsl'];

  async generate(
    model: CMLModel,
    options?: MDSLGeneratorOptions
  ): Promise<GeneratorResult> {
    // Check prerequisites
    const status = await getCLIStatus();

    if (!status.javaAvailable) {
      return javaNotFoundError();
    }

    if (!status.javaCompatible) {
      return javaVersionError(status.javaVersion || 'unknown');
    }

    if (!status.cliInstalled) {
      return cliNotFoundError();
    }

    // Check for upstream-downstream relationships
    if (!model.contextMap || model.contextMap.relationships.length === 0) {
      return createErrorResult(
        'INVALID_CML',
        'No context map relationships found',
        'MDSL generation requires upstream-downstream relationships in the context map'
      );
    }

    const hasUpstreamDownstream = model.contextMap.relationships.some(
      (rel) => rel.type === 'UpstreamDownstream'
    );

    if (!hasUpstreamDownstream) {
      return createErrorResult(
        'INVALID_CML',
        'No upstream-downstream relationships found',
        'MDSL generation requires at least one upstream-downstream relationship in the context map'
      );
    }

    // Use temp files with automatic cleanup
    return withTempFiles(async (tempContext) => {
      try {
        // Serialize model to CML
        const cmlContent = serializeCML(model);
        const tempDir = await tempContext.createDir();
        const cmlPath = await tempContext.createCMLFile(cmlContent, tempDir);

        // Determine output directory
        const config = getCLIConfig();
        const outputDir = options?.outputDir ?? config.outputDir;

        // Build extra arguments
        const extraArgs: string[] = [];

        // Execute CLI
        const executor = getCLIExecutor();
        const result = await executor.generate(
          cmlPath,
          'mdsl',
          outputDir,
          extraArgs,
          { timeout: options?.timeout }
        );

        if (result.timedOut) {
          return executionTimeoutError(options?.timeout ?? config.timeout);
        }

        if (!result.success) {
          return createErrorResult(
            'EXECUTION_FAILED',
            result.error || 'CLI execution failed',
            'Check the CML model for errors using cml_validate_model',
            result.stderr
          );
        }

        // Find generated MDSL files
        const generatedFiles = await this.findGeneratedFiles(outputDir);

        if (generatedFiles.length === 0) {
          return createErrorResult(
            'OUTPUT_NOT_FOUND',
            'No MDSL files were generated',
            'Ensure the model has upstream-downstream relationships with exposed aggregates'
          );
        }

        // Read file contents for output
        const outputs: GeneratorOutput[] = await Promise.all(
          generatedFiles.map(async (filePath) => {
            const content = await readFile(filePath, 'utf-8');
            return {
              type: 'file' as const,
              path: filePath,
              content,
              format: 'mdsl',
              description: `MDSL contract: ${basename(filePath)}`,
            };
          })
        );

        // Include any warnings from stderr
        const warnings = result.stderr
          ? result.stderr.split('\n').filter((line) => line.trim().length > 0)
          : undefined;

        return createSuccessResult(outputs, warnings);
      } catch (error) {
        return createErrorResult(
          'INTERNAL_ERROR',
          error instanceof Error ? error.message : 'Unknown error during generation'
        );
      }
    });
  }

  /**
   * Find generated MDSL files in the output directory
   */
  private async findGeneratedFiles(outputDir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(outputDir);

      for (const entry of entries) {
        if (entry.endsWith('.mdsl')) {
          const entryPath = join(outputDir, entry);
          const entryStat = await stat(entryPath);

          if (entryStat.isFile()) {
            files.push(entryPath);
          }
        }
      }
    } catch {
      // Directory may not exist
    }

    return files;
  }
}

/**
 * Create the MDSL generator
 */
export function createMDSLGenerator(): IGenerator {
  return new MDSLGenerator();
}
