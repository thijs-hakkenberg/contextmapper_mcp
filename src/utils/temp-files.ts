/**
 * Temporary File Utilities
 * Provides utilities for creating and cleaning up temporary CML files
 */

import { writeFile, mkdir, rm, stat, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

/**
 * Get the base temporary directory for context-mapper-mcp
 */
export function getTempBaseDir(): string {
  return join(tmpdir(), 'context-mapper-mcp');
}

/**
 * Create a unique temporary directory
 * @returns Path to the created directory
 */
export async function createTempDir(): Promise<string> {
  const baseDir = getTempBaseDir();
  const uniqueDir = join(baseDir, `session-${randomUUID()}`);
  await mkdir(uniqueDir, { recursive: true });
  return uniqueDir;
}

/**
 * Create a temporary CML file
 * @param content CML content to write
 * @param dir Optional directory to create the file in (creates a new temp dir if not provided)
 * @returns Path to the created file
 */
export async function createTempCMLFile(content: string, dir?: string): Promise<string> {
  const targetDir = dir || await createTempDir();
  const fileName = `model-${randomUUID()}.cml`;
  const filePath = join(targetDir, fileName);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Create a temporary file with custom extension
 * @param content Content to write
 * @param extension File extension (without dot)
 * @param dir Optional directory to create the file in
 * @returns Path to the created file
 */
export async function createTempFile(
  content: string,
  extension: string,
  dir?: string
): Promise<string> {
  const targetDir = dir || await createTempDir();
  const fileName = `temp-${randomUUID()}.${extension}`;
  const filePath = join(targetDir, fileName);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Clean up a temporary file or directory
 * @param path Path to the file or directory to remove
 * @param recursive Whether to remove directories recursively (default: true)
 */
export async function cleanupTemp(path: string, recursive: boolean = true): Promise<void> {
  try {
    await rm(path, { recursive, force: true });
  } catch (error) {
    // Ignore errors during cleanup (file may not exist)
  }
}

/**
 * Clean up all temporary files older than a certain age
 * @param maxAgeMs Maximum age in milliseconds (default: 1 hour)
 */
export async function cleanupOldTempFiles(maxAgeMs: number = 60 * 60 * 1000): Promise<void> {
  const baseDir = getTempBaseDir();
  const now = Date.now();

  try {
    const entries = await readdir(baseDir);

    for (const entry of entries) {
      const entryPath = join(baseDir, entry);
      try {
        const stats = await stat(entryPath);
        const age = now - stats.mtimeMs;

        if (age > maxAgeMs) {
          await cleanupTemp(entryPath);
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Base directory may not exist yet
  }
}

/**
 * Context for managing temporary files with automatic cleanup
 */
export class TempFileContext {
  private files: string[] = [];
  private dirs: string[] = [];

  /**
   * Create a temporary directory and track it for cleanup
   */
  async createDir(): Promise<string> {
    const dir = await createTempDir();
    this.dirs.push(dir);
    return dir;
  }

  /**
   * Create a temporary CML file and track it for cleanup
   */
  async createCMLFile(content: string, dir?: string): Promise<string> {
    const filePath = await createTempCMLFile(content, dir);
    this.files.push(filePath);
    return filePath;
  }

  /**
   * Create a temporary file with custom extension
   */
  async createFile(content: string, extension: string, dir?: string): Promise<string> {
    const filePath = await createTempFile(content, extension, dir);
    this.files.push(filePath);
    return filePath;
  }

  /**
   * Track an existing file for cleanup
   */
  trackFile(path: string): void {
    this.files.push(path);
  }

  /**
   * Track an existing directory for cleanup
   */
  trackDir(path: string): void {
    this.dirs.push(path);
  }

  /**
   * Clean up all tracked files and directories
   */
  async cleanup(): Promise<void> {
    // Clean up files first
    for (const file of this.files) {
      await cleanupTemp(file, false);
    }

    // Then clean up directories
    for (const dir of this.dirs) {
      await cleanupTemp(dir, true);
    }

    this.files = [];
    this.dirs = [];
  }
}

/**
 * Run an async function with automatic temp file cleanup
 * @param fn Function to run with a TempFileContext
 * @returns Result of the function
 */
export async function withTempFiles<T>(
  fn: (context: TempFileContext) => Promise<T>
): Promise<T> {
  const context = new TempFileContext();
  try {
    return await fn(context);
  } finally {
    await context.cleanup();
  }
}
