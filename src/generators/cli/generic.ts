/**
 * Generic Freemarker CLI Generator
 * Generates outputs from Freemarker templates using the Context Mapper CLI
 */

import { readdir, readFile, stat, access } from 'fs/promises';
import { join, basename, extname } from 'path';
import { constants } from 'fs';

import type { CMLModel } from '../../model/types.js';
import type {
  IGenerator,
  GeneratorResult,
  GeneratorOptions,
  GenericGeneratorOptions,
  GeneratorOutput,
} from '../interfaces.js';
import {
  createSuccessResult,
  createErrorResult,
  cliNotFoundError,
  javaNotFoundError,
  javaVersionError,
  executionTimeoutError,
  templateNotFoundError,
} from '../interfaces.js';
import { serializeCML } from '../../model/writer.js';
import { withTempFiles } from '../../utils/temp-files.js';
import { getCLIExecutor, getCLIStatus } from './executor.js';
import { getCLIConfig, getBundledTemplate } from './config.js';

/**
 * Check if a file exists and is accessible
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generic Freemarker Generator
 * Uses CLI to generate outputs from custom Freemarker templates
 */
export class GenericFreemarkerGenerator implements IGenerator {
  name = 'generic-freemarker';
  description = 'Generate outputs from custom Freemarker templates';
  requiresCLI = true;
  outputFormats = ['*']; // Depends on template

  async generate(
    model: CMLModel,
    options?: GenericGeneratorOptions
  ): Promise<GeneratorResult> {
    if (!options?.templatePath) {
      return createErrorResult(
        'TEMPLATE_NOT_FOUND',
        'templatePath is required',
        'Provide the path to a Freemarker (.ftl) template file'
      );
    }

    // Check if template exists
    if (!(await fileExists(options.templatePath))) {
      return templateNotFoundError(options.templatePath);
    }

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
        const extraArgs: string[] = [
          '-t', options.templatePath,
        ];

        // Optional output file name
        if (options.outputFileName) {
          extraArgs.push('-f', options.outputFileName);
        }

        // Execute CLI
        const executor = getCLIExecutor();
        const result = await executor.generate(
          cmlPath,
          'generic',
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
            'Check the template syntax and CML model for errors',
            result.stderr
          );
        }

        // Find generated files
        const generatedFiles = await this.findGeneratedFiles(outputDir, options.templatePath);

        if (generatedFiles.length === 0) {
          return createErrorResult(
            'OUTPUT_NOT_FOUND',
            'No output files were generated',
            'Check the template for errors or ensure the model has content to process'
          );
        }

        // Read file contents for output
        const outputs: GeneratorOutput[] = await Promise.all(
          generatedFiles.map(async (filePath) => {
            const content = await readFile(filePath, 'utf-8');
            const format = this.getFormatFromExtension(filePath);
            return {
              type: 'file' as const,
              path: filePath,
              content,
              format,
              description: `Generated from template: ${basename(filePath)}`,
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
   * Find generated files in the output directory
   * Uses the template name to infer expected output extension
   */
  private async findGeneratedFiles(
    outputDir: string,
    templatePath: string
  ): Promise<string[]> {
    const files: string[] = [];

    // Get expected extension from template name (e.g., "GlossaryTemplate.md.ftl" -> ".md")
    const templateBase = basename(templatePath);
    const expectedExt = this.getExpectedExtension(templateBase);

    try {
      const entries = await readdir(outputDir);

      for (const entry of entries) {
        // Match files with expected extension or any recently created files
        const entryPath = join(outputDir, entry);
        const entryStat = await stat(entryPath);

        if (entryStat.isFile()) {
          if (expectedExt && entry.endsWith(expectedExt)) {
            files.push(entryPath);
          } else if (!expectedExt && !entry.endsWith('.cml')) {
            // If we can't determine extension, include non-CML files
            files.push(entryPath);
          }
        }
      }
    } catch {
      // Directory may not exist
    }

    return files;
  }

  /**
   * Get expected output extension from template filename
   * Templates are named like "Name.ext.ftl" where ext is the output extension
   */
  private getExpectedExtension(templateName: string): string | null {
    // Remove .ftl extension
    const withoutFtl = templateName.replace(/\.ftl$/i, '');
    const ext = extname(withoutFtl);
    return ext || null;
  }

  /**
   * Get format string from file extension
   */
  private getFormatFromExtension(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    switch (ext) {
      case '.md':
        return 'markdown';
      case '.jdl':
        return 'jdl';
      case '.json':
        return 'json';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.xml':
        return 'xml';
      case '.html':
        return 'html';
      default:
        return ext.replace('.', '') || 'text';
    }
  }
}

/**
 * Bundled Template Generator
 * Pre-configured generator for bundled templates
 */
export class BundledTemplateGenerator implements IGenerator {
  name: string;
  description: string;
  requiresCLI = true;
  outputFormats: string[];
  private templateName: string;
  private genericGenerator: GenericFreemarkerGenerator;

  constructor(
    name: string,
    description: string,
    templateName: string,
    outputFormat: string
  ) {
    this.name = name;
    this.description = description;
    this.templateName = templateName;
    this.outputFormats = [outputFormat];
    this.genericGenerator = new GenericFreemarkerGenerator();
  }

  async generate(
    model: CMLModel,
    options?: GeneratorOptions
  ): Promise<GeneratorResult> {
    const templateInfo = getBundledTemplate(this.templateName);

    if (!templateInfo) {
      return createErrorResult(
        'TEMPLATE_NOT_FOUND',
        `Bundled template '${this.templateName}' not found`,
        'This is an internal error - the bundled templates may not be installed correctly'
      );
    }

    // Check if template file exists
    if (!(await fileExists(templateInfo.path))) {
      return createErrorResult(
        'TEMPLATE_NOT_FOUND',
        `Bundled template file not found: ${templateInfo.path}`,
        'Reinstall the package to restore bundled templates'
      );
    }

    // Use the generic generator with the bundled template
    return this.genericGenerator.generate(model, {
      ...options,
      templatePath: templateInfo.path,
    });
  }
}

/**
 * Create the Generic Freemarker generator
 */
export function createGenericFreemarkerGenerator(): IGenerator {
  return new GenericFreemarkerGenerator();
}

/**
 * Create generators for bundled templates
 */
export function createBundledTemplateGenerators(): IGenerator[] {
  return [
    new BundledTemplateGenerator(
      'glossary',
      'Generate ubiquitous language glossary from domain model',
      'glossary',
      'markdown'
    ),
    new BundledTemplateGenerator(
      'jhipster-microservices',
      'Generate JHipster JDL for microservices architecture',
      'jhipster-microservices',
      'jdl'
    ),
    new BundledTemplateGenerator(
      'jhipster-monolith',
      'Generate JHipster JDL for monolithic application',
      'jhipster-monolith',
      'jdl'
    ),
    new BundledTemplateGenerator(
      'full-report',
      'Generate comprehensive domain documentation',
      'full-report',
      'markdown'
    ),
  ];
}
