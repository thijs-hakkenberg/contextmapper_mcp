/**
 * Context Map CLI Generator
 * Generates Context Map graphics (PNG/SVG) using the Context Mapper CLI
 */

import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';

import type { CMLModel } from '../../model/types.js';
import type {
  IGenerator,
  GeneratorResult,
  ContextMapGeneratorOptions,
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
import { getCLIExecutor, checkJava, getCLIStatus } from './executor.js';
import { getCLIConfig } from './config.js';

/**
 * Context Map Image Generator
 * Uses CLI to generate PNG or SVG context map visualizations
 */
export class ContextMapImageGenerator implements IGenerator {
  name = 'context-map-image';
  description = 'Generate Context Map visualization (PNG/SVG) using Context Mapper CLI';
  requiresCLI = true;
  outputFormats = ['png', 'svg'];

  async generate(
    model: CMLModel,
    options?: ContextMapGeneratorOptions
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

        // Format option
        const format = options?.format ?? 'png';
        // Context Map generator always outputs to png/svg based on format arg
        if (format === 'svg') {
          extraArgs.push('--outputFormat', 'svg');
        }

        // Width/height options
        if (options?.width) {
          extraArgs.push('--width', options.width.toString());
        }
        if (options?.height) {
          extraArgs.push('--height', options.height.toString());
        }
        if (options?.fixWidth) {
          extraArgs.push('--fix-width');
        }
        if (options?.fixHeight) {
          extraArgs.push('--fix-height');
        }

        // Execute CLI
        const executor = getCLIExecutor();
        const result = await executor.generate(
          cmlPath,
          'context-map',
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

        // Find generated files
        const generatedFiles = await this.findGeneratedFiles(outputDir, format);

        if (generatedFiles.length === 0) {
          return createErrorResult(
            'OUTPUT_NOT_FOUND',
            'No output files were generated',
            'Ensure the model has a context map defined'
          );
        }

        const outputs: GeneratorOutput[] = generatedFiles.map((filePath) => ({
          type: 'file' as const,
          path: filePath,
          format,
          description: `Context Map image: ${basename(filePath)}`,
        }));

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
   * Find generated files in the output directory
   */
  private async findGeneratedFiles(
    outputDir: string,
    format: string
  ): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(outputDir);

      for (const entry of entries) {
        if (entry.endsWith(`.${format}`)) {
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
 * Create the Context Map image generator
 */
export function createContextMapImageGenerator(): IGenerator {
  return new ContextMapImageGenerator();
}
