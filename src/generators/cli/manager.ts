/**
 * CLI Manager
 * Handles CLI download, extraction, and version management
 */

import { createWriteStream, createReadStream } from 'fs';
import { mkdir, rm, stat, chmod, rename, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { extract as tarExtract } from 'tar';

import {
  getCLIConfig,
  getCLIVersionDir,
  getCLIExecutablePath,
  getCLIDownloadUrl,
  isWindows,
  DEFAULT_CLI_VERSION,
} from './config.js';

/**
 * Result of CLI verification
 */
export interface CLIVerifyResult {
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
}

/**
 * Result of CLI download
 */
export interface CLIDownloadResult {
  success: boolean;
  version?: string;
  path?: string;
  error?: string;
}

/**
 * Check if a file or directory exists
 */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * CLI Manager class
 */
export class CLIManager {
  private version: string;

  constructor(version: string = DEFAULT_CLI_VERSION) {
    this.version = version;
  }

  /**
   * Get CLI path, downloading if not present
   * @returns Path to CLI and version info
   */
  async ensureCLI(): Promise<{ path: string; version: string }> {
    const verification = await this.verify();

    if (verification.installed && verification.path) {
      return { path: verification.path, version: this.version };
    }

    // Download and install
    const downloadResult = await this.downloadCLI();
    if (!downloadResult.success) {
      throw new Error(downloadResult.error || 'Failed to download CLI');
    }

    return {
      path: getCLIExecutablePath(this.version),
      version: this.version,
    };
  }

  /**
   * Check if CLI is installed and working
   */
  async verify(): Promise<CLIVerifyResult> {
    const cliPath = getCLIExecutablePath(this.version);

    try {
      const pathExists = await exists(cliPath);
      if (!pathExists) {
        return { installed: false, error: 'CLI not found' };
      }

      return {
        installed: true,
        version: this.version,
        path: cliPath,
      };
    } catch (error) {
      return {
        installed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Download CLI from Maven Central
   */
  async downloadCLI(): Promise<CLIDownloadResult> {
    const config = getCLIConfig();
    const versionDir = getCLIVersionDir(this.version);
    const downloadUrl = getCLIDownloadUrl(this.version);

    try {
      // Create version directory
      await mkdir(versionDir, { recursive: true });

      // Determine archive type and temp path
      const archiveExt = isWindows() ? 'zip' : 'tar';
      const tempArchivePath = join(versionDir, `cli.${archiveExt}`);

      // Download the archive
      console.error(`Downloading Context Mapper CLI ${this.version} from Maven Central...`);
      await this.downloadFile(downloadUrl, tempArchivePath);

      // Extract the archive
      console.error('Extracting CLI...');
      await this.extractArchive(tempArchivePath, versionDir);

      // Clean up archive
      await rm(tempArchivePath, { force: true });

      // Make executable on Unix
      if (!isWindows()) {
        const cliPath = getCLIExecutablePath(this.version);
        try {
          await chmod(cliPath, 0o755);
        } catch {
          // May fail if file doesn't exist yet
        }
      }

      console.error(`CLI ${this.version} installed successfully`);

      return {
        success: true,
        version: this.version,
        path: getCLIExecutablePath(this.version),
      };
    } catch (error) {
      // Clean up on failure
      try {
        await rm(versionDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown download error',
      };
    }
  }

  /**
   * Download a file from URL
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Ensure parent directory exists
    await mkdir(dirname(destPath), { recursive: true });

    // Write to file using streams
    const fileStream = createWriteStream(destPath);

    // Convert ReadableStream to Node.js Readable
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    fileStream.write(buffer);
    fileStream.end();

    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });
  }

  /**
   * Extract archive (TAR or ZIP)
   */
  private async extractArchive(archivePath: string, destDir: string): Promise<void> {
    if (isWindows()) {
      await this.extractZip(archivePath, destDir);
    } else {
      await this.extractTar(archivePath, destDir);
    }

    // Handle nested directory structure
    // The CLI archive may extract to a subdirectory like context-mapper-cli-6.12.0/
    await this.flattenExtractedDir(destDir);
  }

  /**
   * Extract TAR archive (for Unix)
   */
  private async extractTar(archivePath: string, destDir: string): Promise<void> {
    // The TAR from Maven is not gzipped
    await tarExtract({
      file: archivePath,
      cwd: destDir,
    });
  }

  /**
   * Extract ZIP archive (for Windows)
   * Using native unzip as Node.js doesn't have built-in ZIP support
   */
  private async extractZip(archivePath: string, destDir: string): Promise<void> {
    // Use PowerShell to extract on Windows
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const ps = spawn('powershell', [
        '-Command',
        `Expand-Archive -Path "${archivePath}" -DestinationPath "${destDir}" -Force`,
      ]);

      ps.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ZIP extraction failed with code ${code}`));
        }
      });

      ps.on('error', reject);
    });
  }

  /**
   * Flatten extracted directory if CLI was extracted to a subdirectory
   */
  private async flattenExtractedDir(destDir: string): Promise<void> {
    const entries = await readdir(destDir);

    // Look for the CLI directory pattern (context-mapper-cli-X.X.X)
    const cliSubdir = entries.find(
      (e) => e.startsWith('context-mapper-cli-') && !e.endsWith('.tar') && !e.endsWith('.zip')
    );

    if (cliSubdir) {
      const subdirPath = join(destDir, cliSubdir);
      const subdirStat = await stat(subdirPath);

      if (subdirStat.isDirectory()) {
        // Move contents up
        const subdirEntries = await readdir(subdirPath);

        for (const entry of subdirEntries) {
          const srcPath = join(subdirPath, entry);
          const destPath = join(destDir, entry);

          // Remove existing if present
          if (await exists(destPath)) {
            await rm(destPath, { recursive: true, force: true });
          }

          await rename(srcPath, destPath);
        }

        // Remove empty subdirectory
        await rm(subdirPath, { recursive: true, force: true });
      }
    }
  }

  /**
   * Remove installed CLI
   */
  async uninstall(): Promise<void> {
    const versionDir = getCLIVersionDir(this.version);
    await rm(versionDir, { recursive: true, force: true });
  }

  /**
   * Get installed CLI versions
   */
  static async getInstalledVersions(): Promise<string[]> {
    const config = getCLIConfig();
    const cliDir = config.cliDir;

    try {
      const entries = await readdir(cliDir);
      const versions: string[] = [];

      for (const entry of entries) {
        const entryPath = join(cliDir, entry);
        const entryStat = await stat(entryPath);

        if (entryStat.isDirectory()) {
          // Check if it looks like a version directory
          if (/^\d+\.\d+\.\d+/.test(entry)) {
            versions.push(entry);
          }
        }
      }

      return versions.sort();
    } catch {
      return [];
    }
  }
}

// Singleton manager instance
let managerInstance: CLIManager | null = null;

/**
 * Get the CLI manager instance
 */
export function getCLIManager(): CLIManager {
  if (!managerInstance) {
    managerInstance = new CLIManager();
  }
  return managerInstance;
}

/**
 * Set the CLI version and recreate manager
 */
export function setCLIVersion(version: string): CLIManager {
  managerInstance = new CLIManager(version);
  return managerInstance;
}
