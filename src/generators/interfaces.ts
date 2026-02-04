/**
 * Generator Interfaces and Types
 * Defines the contract for all generators (builtin and CLI-based)
 */

import type { CMLModel } from '../model/types.js';

/**
 * Error types for generator failures
 */
export type GeneratorErrorType =
  | 'CLI_NOT_FOUND'
  | 'CLI_DOWNLOAD_FAILED'
  | 'JAVA_NOT_FOUND'
  | 'JAVA_VERSION_INCOMPATIBLE'
  | 'EXECUTION_FAILED'
  | 'EXECUTION_TIMEOUT'
  | 'INVALID_CML'
  | 'TEMPLATE_NOT_FOUND'
  | 'OUTPUT_NOT_FOUND'
  | 'INTERNAL_ERROR';

/**
 * Structured error for generator failures
 */
export interface GeneratorError {
  type: GeneratorErrorType;
  message: string;
  suggestion?: string;
  details?: string;
}

/**
 * Output from a generator
 */
export interface GeneratorOutput {
  /** Type of output */
  type: 'file' | 'content';
  /** File path (for type: 'file') */
  path?: string;
  /** Content (for type: 'content') */
  content?: string;
  /** Output format */
  format: string; // 'png', 'svg', 'mdsl', 'md', 'jdl', 'plantuml', etc.
  /** Description of the output */
  description?: string;
}

/**
 * Result from running a generator
 */
export interface GeneratorResult {
  success: boolean;
  outputs?: GeneratorOutput[];
  error?: GeneratorError;
  warnings?: string[];
}

/**
 * Options passed to a generator
 */
export interface GeneratorOptions {
  /** Output directory for file outputs */
  outputDir?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Generator-specific options */
  [key: string]: unknown;
}

/**
 * Context Map generator specific options
 */
export interface ContextMapGeneratorOptions extends GeneratorOptions {
  /** Output format for the image */
  format?: 'png' | 'svg';
  /** Width of the image */
  width?: number;
  /** Height of the image */
  height?: number;
  /** Fix the width */
  fixWidth?: boolean;
  /** Fix the height */
  fixHeight?: boolean;
  /** Generate for specific bounded contexts only */
  boundedContexts?: string[];
}

/**
 * MDSL generator specific options
 */
export interface MDSLGeneratorOptions extends GeneratorOptions {
  /** Generate for specific bounded contexts only */
  boundedContexts?: string[];
}

/**
 * Generic/Freemarker generator specific options
 */
export interface GenericGeneratorOptions extends GeneratorOptions {
  /** Path to the Freemarker template file */
  templatePath: string;
  /** Output file name (without directory) */
  outputFileName?: string;
}

/**
 * Generator interface - all generators must implement this
 */
export interface IGenerator {
  /** Unique name for this generator */
  name: string;
  /** Human-readable description */
  description: string;
  /** Whether this generator requires the CLI */
  requiresCLI: boolean;
  /** Supported output formats */
  outputFormats: string[];
  /**
   * Run the generator
   * @param model The CML model to generate from
   * @param options Generator options
   * @returns Generator result with outputs or error
   */
  generate(model: CMLModel, options?: GeneratorOptions): Promise<GeneratorResult>;
}

/**
 * Generator availability status
 */
export interface GeneratorAvailability {
  name: string;
  available: boolean;
  requiresCLI: boolean;
  reason?: string;
}

/**
 * Create a successful generator result
 */
export function createSuccessResult(outputs: GeneratorOutput[], warnings?: string[]): GeneratorResult {
  return {
    success: true,
    outputs,
    warnings,
  };
}

/**
 * Create a failed generator result
 */
export function createErrorResult(
  type: GeneratorErrorType,
  message: string,
  suggestion?: string,
  details?: string
): GeneratorResult {
  return {
    success: false,
    error: {
      type,
      message,
      suggestion,
      details,
    },
  };
}

/**
 * Helper to create CLI not found error
 */
export function cliNotFoundError(): GeneratorResult {
  return createErrorResult(
    'CLI_NOT_FOUND',
    'Context Mapper CLI not found',
    'Run cml_download_cli to download and install the CLI, or use cml_configure_cli to set a custom path'
  );
}

/**
 * Helper to create Java not found error
 */
export function javaNotFoundError(): GeneratorResult {
  return createErrorResult(
    'JAVA_NOT_FOUND',
    'Java runtime not found',
    'Install JDK 17+ from https://adoptium.net or set JAVA_HOME environment variable'
  );
}

/**
 * Helper to create Java version error
 */
export function javaVersionError(foundVersion: string): GeneratorResult {
  return createErrorResult(
    'JAVA_VERSION_INCOMPATIBLE',
    `Java 17+ required, found ${foundVersion}`,
    'Upgrade Java to version 17 or later from https://adoptium.net'
  );
}

/**
 * Helper to create execution timeout error
 */
export function executionTimeoutError(timeoutMs: number): GeneratorResult {
  return createErrorResult(
    'EXECUTION_TIMEOUT',
    `CLI timed out after ${timeoutMs}ms`,
    'Try increasing the timeout in generator options'
  );
}

/**
 * Helper to create template not found error
 */
export function templateNotFoundError(templatePath: string): GeneratorResult {
  return createErrorResult(
    'TEMPLATE_NOT_FOUND',
    `Template not found: ${templatePath}`,
    'Verify the template path exists and is accessible'
  );
}
