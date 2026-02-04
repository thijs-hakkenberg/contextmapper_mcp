/**
 * CLI Tools - Configuration and status tools for the Context Mapper CLI
 */

import { getCLIConfig, setCLIConfig, resetCLIConfig, getBundledTemplates, DEFAULT_CLI_VERSION } from '../generators/cli/config.js';
import { getCLIManager, CLIManager } from '../generators/cli/manager.js';
import { getCLIStatus, checkJava } from '../generators/cli/executor.js';
import { getGeneratorRegistry } from '../generators/registry.js';

// ==========================================
// Tool: cml_cli_status
// ==========================================

export interface CLIStatusResult {
  success: boolean;
  status?: {
    javaAvailable: boolean;
    javaVersion?: string;
    javaCompatible: boolean;
    cliInstalled: boolean;
    cliVersion?: string;
    cliPath?: string;
    ready: boolean;
    issues: string[];
  };
  config?: {
    cliDir: string;
    version: string;
    javaHome: string | null;
    outputDir: string;
    timeout: number;
  };
  installedVersions?: string[];
  error?: string;
}

/**
 * Check CLI and Java availability status
 */
export async function cliStatusTool(): Promise<CLIStatusResult> {
  try {
    const status = await getCLIStatus();
    const config = getCLIConfig();
    const installedVersions = await CLIManager.getInstalledVersions();

    return {
      success: true,
      status: {
        javaAvailable: status.javaAvailable,
        javaVersion: status.javaVersion,
        javaCompatible: status.javaCompatible,
        cliInstalled: status.cliInstalled,
        cliVersion: status.cliVersion,
        cliPath: status.cliPath,
        ready: status.ready,
        issues: status.issues,
      },
      config: {
        cliDir: config.cliDir,
        version: config.version,
        javaHome: config.javaHome,
        outputDir: config.outputDir,
        timeout: config.timeout,
      },
      installedVersions,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error checking CLI status',
    };
  }
}

// ==========================================
// Tool: cml_configure_cli
// ==========================================

export interface ConfigureCLIParams {
  cliDir?: string;
  version?: string;
  javaHome?: string;
  outputDir?: string;
  timeout?: number;
}

export interface ConfigureCLIResult {
  success: boolean;
  config?: {
    cliDir: string;
    version: string;
    javaHome: string | null;
    outputDir: string;
    timeout: number;
  };
  error?: string;
}

/**
 * Configure CLI settings
 */
export function configureCLITool(params: ConfigureCLIParams): ConfigureCLIResult {
  try {
    const updates: Partial<typeof params> = {};

    if (params.cliDir !== undefined) {
      updates.cliDir = params.cliDir;
    }
    if (params.version !== undefined) {
      updates.version = params.version;
    }
    if (params.javaHome !== undefined) {
      (updates as any).javaHome = params.javaHome || null;
    }
    if (params.outputDir !== undefined) {
      updates.outputDir = params.outputDir;
    }
    if (params.timeout !== undefined) {
      if (params.timeout < 1000) {
        return {
          success: false,
          error: 'Timeout must be at least 1000ms (1 second)',
        };
      }
      updates.timeout = params.timeout;
    }

    const config = setCLIConfig(updates as any);

    return {
      success: true,
      config: {
        cliDir: config.cliDir,
        version: config.version,
        javaHome: config.javaHome,
        outputDir: config.outputDir,
        timeout: config.timeout,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error configuring CLI',
    };
  }
}

// ==========================================
// Tool: cml_download_cli
// ==========================================

export interface DownloadCLIParams {
  version?: string;
  force?: boolean;
}

export interface DownloadCLIResult {
  success: boolean;
  version?: string;
  path?: string;
  message?: string;
  error?: string;
}

/**
 * Download and install the Context Mapper CLI
 */
export async function downloadCLITool(params: DownloadCLIParams = {}): Promise<DownloadCLIResult> {
  try {
    const version = params.version || DEFAULT_CLI_VERSION;
    const manager = new CLIManager(version);

    // Check if already installed
    const verification = await manager.verify();
    if (verification.installed && !params.force) {
      return {
        success: true,
        version,
        path: verification.path,
        message: `CLI version ${version} is already installed. Use force: true to reinstall.`,
      };
    }

    // Check Java first
    const javaInfo = await checkJava();
    if (!javaInfo.available) {
      return {
        success: false,
        error: 'Java runtime not found. Install JDK 17+ from https://adoptium.net before downloading CLI.',
      };
    }

    if (!javaInfo.compatible) {
      return {
        success: false,
        error: `Java 17+ required, found ${javaInfo.version}. Upgrade Java before downloading CLI.`,
      };
    }

    // Uninstall if forcing reinstall
    if (verification.installed && params.force) {
      await manager.uninstall();
    }

    // Download
    const result = await manager.downloadCLI();

    if (result.success) {
      // Update registry availability
      const registry = getGeneratorRegistry();
      registry.setCLIAvailable(true);
      registry.setJavaAvailable(true);

      return {
        success: true,
        version: result.version,
        path: result.path,
        message: `Successfully installed Context Mapper CLI ${version}`,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to download CLI',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error downloading CLI',
    };
  }
}

// ==========================================
// Tool: cml_list_generators
// ==========================================

export interface ListGeneratorsResult {
  success: boolean;
  generators?: Array<{
    name: string;
    description: string;
    requiresCLI: boolean;
    available: boolean;
    outputFormats: string[];
    reason?: string;
  }>;
  bundledTemplates?: Array<{
    name: string;
    description: string;
    outputExtension: string;
  }>;
  error?: string;
}

/**
 * List all available generators and their status
 */
export async function listGeneratorsTool(): Promise<ListGeneratorsResult> {
  try {
    const registry = getGeneratorRegistry();
    const status = await getCLIStatus();

    // Update registry with current status
    registry.setJavaAvailable(status.javaAvailable && status.javaCompatible);
    registry.setCLIAvailable(status.cliInstalled);

    const availability = registry.getAvailability();
    const allGenerators = registry.getAll();

    const generators = allGenerators.map((gen) => {
      const avail = availability.find((a) => a.name === gen.name);
      return {
        name: gen.name,
        description: gen.description,
        requiresCLI: gen.requiresCLI,
        available: avail?.available ?? !gen.requiresCLI,
        outputFormats: gen.outputFormats,
        reason: avail?.reason,
      };
    });

    // Get bundled templates
    const bundledTemplates = getBundledTemplates().map((t) => ({
      name: t.name,
      description: t.description,
      outputExtension: t.outputExtension,
    }));

    return {
      success: true,
      generators,
      bundledTemplates,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error listing generators',
    };
  }
}

// ==========================================
// Tool: cml_reset_cli_config
// ==========================================

export interface ResetCLIConfigResult {
  success: boolean;
  config?: {
    cliDir: string;
    version: string;
    javaHome: string | null;
    outputDir: string;
    timeout: number;
  };
  error?: string;
}

/**
 * Reset CLI configuration to defaults
 */
export function resetCLIConfigTool(): ResetCLIConfigResult {
  try {
    const config = resetCLIConfig();

    return {
      success: true,
      config: {
        cliDir: config.cliDir,
        version: config.version,
        javaHome: config.javaHome,
        outputDir: config.outputDir,
        timeout: config.timeout,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error resetting CLI config',
    };
  }
}
