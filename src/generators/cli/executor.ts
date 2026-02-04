/**
 * CLI Executor
 * Handles Java detection and CLI process execution
 */

import { spawn } from 'child_process';
import { stat } from 'fs/promises';
import {
  getCLIConfig,
  getJavaExecutablePath,
  getCLIExecutablePath,
  MIN_JAVA_VERSION,
  DEFAULT_CLI_TIMEOUT,
  isWindows,
} from './config.js';
import { getCLIManager } from './manager.js';

/**
 * Java version info
 */
export interface JavaInfo {
  available: boolean;
  version?: string;
  majorVersion?: number;
  compatible?: boolean;
  path?: string;
  error?: string;
}

/**
 * CLI execution result
 */
export interface CLIExecutionResult {
  success: boolean;
  exitCode?: number;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
}

/**
 * CLI command options
 */
export interface CLICommandOptions {
  /** Working directory */
  cwd?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables to add */
  env?: Record<string, string>;
}

/**
 * Check if a file exists
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
 * Check Java availability and version
 */
export async function checkJava(): Promise<JavaInfo> {
  const javaPath = getJavaExecutablePath();

  return new Promise((resolve) => {
    const process = spawn(javaPath, ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('error', (error) => {
      resolve({
        available: false,
        error: `Java not found: ${error.message}`,
      });
    });

    process.on('close', (code) => {
      if (code !== 0) {
        resolve({
          available: false,
          error: `Java version check failed with code ${code}`,
        });
        return;
      }

      // Java outputs version to stderr
      const output = stderr || stdout;

      // Parse version from output like:
      // java version "17.0.1" or openjdk version "17.0.1"
      const versionMatch = output.match(/version "(\d+)(?:\.(\d+))?(?:\.(\d+))?/);

      if (!versionMatch) {
        resolve({
          available: true,
          path: javaPath,
          error: 'Could not parse Java version',
        });
        return;
      }

      const majorVersion = parseInt(versionMatch[1], 10);
      const version = versionMatch[0].replace('version ', '').replace(/"/g, '');

      resolve({
        available: true,
        version,
        majorVersion,
        compatible: majorVersion >= MIN_JAVA_VERSION,
        path: javaPath,
      });
    });

    // Timeout for Java check
    setTimeout(() => {
      process.kill();
      resolve({
        available: false,
        error: 'Java version check timed out',
      });
    }, 10000);
  });
}

/**
 * CLI Executor class
 */
export class CLIExecutor {
  private cliPath: string | null = null;

  /**
   * Ensure CLI is available, downloading if necessary
   */
  async ensureCLI(): Promise<string> {
    if (this.cliPath && await exists(this.cliPath)) {
      return this.cliPath;
    }

    const manager = getCLIManager();
    const { path } = await manager.ensureCLI();
    this.cliPath = path;
    return path;
  }

  /**
   * Execute a CLI command
   * @param args Command arguments (without the CLI path)
   * @param options Execution options
   */
  async execute(args: string[], options: CLICommandOptions = {}): Promise<CLIExecutionResult> {
    const config = getCLIConfig();
    const timeout = options.timeout ?? config.timeout ?? DEFAULT_CLI_TIMEOUT;
    const cwd = options.cwd ?? process.cwd();

    // Ensure CLI is available
    let cliPath: string;
    try {
      cliPath = await this.ensureCLI();
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: '',
        error: error instanceof Error ? error.message : 'Failed to ensure CLI availability',
      };
    }

    // Build environment
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...options.env,
    };

    // Add JAVA_HOME if configured
    if (config.javaHome) {
      env.JAVA_HOME = config.javaHome;
    }

    return new Promise((resolve) => {
      let timedOut = false;

      // On Windows, use cmd.exe to run batch file
      const spawnCommand = isWindows() ? 'cmd.exe' : cliPath;
      const spawnArgs = isWindows() ? ['/c', cliPath, ...args] : args;

      const proc = spawn(spawnCommand, spawnArgs, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        resolve({
          success: false,
          stdout,
          stderr,
          error: `Process error: ${error.message}`,
        });
      });

      proc.on('close', (code) => {
        if (timedOut) {
          resolve({
            success: false,
            exitCode: code ?? undefined,
            stdout,
            stderr,
            error: `Command timed out after ${timeout}ms`,
            timedOut: true,
          });
        } else {
          resolve({
            success: code === 0,
            exitCode: code ?? undefined,
            stdout,
            stderr,
            error: code !== 0 ? `Command exited with code ${code}` : undefined,
          });
        }
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      // Clear timeout on process end
      proc.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  /**
   * Generate artifacts using the CLI
   * @param inputPath Path to the CML file
   * @param generatorName Name of the generator (e.g., 'context-map', 'mdsl', 'generic')
   * @param outputDir Output directory
   * @param extraArgs Additional arguments
   */
  async generate(
    inputPath: string,
    generatorName: string,
    outputDir: string,
    extraArgs: string[] = [],
    options: CLICommandOptions = {}
  ): Promise<CLIExecutionResult> {
    const args = [
      'generate',
      '-i', inputPath,
      '-g', generatorName,
      '-o', outputDir,
      ...extraArgs,
    ];

    return this.execute(args, options);
  }

  /**
   * Get CLI version
   */
  async getVersion(): Promise<string | null> {
    const result = await this.execute(['--version']);
    if (result.success) {
      // Parse version from output
      const versionMatch = result.stdout.match(/(\d+\.\d+\.\d+)/);
      return versionMatch ? versionMatch[1] : null;
    }
    return null;
  }

  /**
   * Validate a CML file using the CLI
   */
  async validate(inputPath: string): Promise<CLIExecutionResult> {
    return this.execute(['validate', '-i', inputPath]);
  }
}

// Singleton instance
let executorInstance: CLIExecutor | null = null;

/**
 * Get the CLI executor instance
 */
export function getCLIExecutor(): CLIExecutor {
  if (!executorInstance) {
    executorInstance = new CLIExecutor();
  }
  return executorInstance;
}

/**
 * Full CLI status check
 */
export interface CLIStatus {
  javaAvailable: boolean;
  javaVersion?: string;
  javaCompatible: boolean;
  cliInstalled: boolean;
  cliVersion?: string;
  cliPath?: string;
  ready: boolean;
  issues: string[];
}

/**
 * Get comprehensive CLI status
 */
export async function getCLIStatus(): Promise<CLIStatus> {
  const issues: string[] = [];
  const javaInfo = await checkJava();
  const manager = getCLIManager();
  const cliVerify = await manager.verify();

  // Check Java
  const javaAvailable = javaInfo.available;
  const javaCompatible = javaInfo.compatible ?? false;

  if (!javaAvailable) {
    issues.push('Java runtime not found. Install JDK 17+ from https://adoptium.net');
  } else if (!javaCompatible) {
    issues.push(`Java ${MIN_JAVA_VERSION}+ required, found ${javaInfo.version}`);
  }

  // Check CLI
  const cliInstalled = cliVerify.installed;

  if (!cliInstalled) {
    issues.push('CLI not installed. Run cml_download_cli to install.');
  }

  return {
    javaAvailable,
    javaVersion: javaInfo.version,
    javaCompatible,
    cliInstalled,
    cliVersion: cliVerify.version,
    cliPath: cliVerify.path,
    ready: javaAvailable && javaCompatible && cliInstalled,
    issues,
  };
}
