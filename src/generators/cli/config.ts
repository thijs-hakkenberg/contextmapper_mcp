/**
 * CLI Configuration
 * Manages paths, versions, and settings for the Context Mapper CLI
 */

import { homedir, platform } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get package root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '..', '..', '..');

/**
 * Default CLI version to use
 */
export const DEFAULT_CLI_VERSION = '6.12.0';

/**
 * Maven Central base URL for CLI downloads
 */
export const MAVEN_BASE_URL = 'https://repo1.maven.org/maven2/org/contextmapper/context-mapper-cli';

/**
 * Minimum required Java version
 */
export const MIN_JAVA_VERSION = 17;

/**
 * Default timeout for CLI operations (5 minutes)
 */
export const DEFAULT_CLI_TIMEOUT = 5 * 60 * 1000;

/**
 * CLI Configuration interface
 */
export interface CLIConfig {
  /** Directory where CLI is installed */
  cliDir: string;
  /** CLI version to use */
  version: string;
  /** Path to java executable (or null to auto-detect) */
  javaHome: string | null;
  /** Default output directory for generated files */
  outputDir: string;
  /** Default timeout for CLI operations in milliseconds */
  timeout: number;
  /** Directory containing bundled templates */
  templatesDir: string;
}

/**
 * Get the default CLI installation directory
 */
export function getDefaultCLIDir(): string {
  return join(homedir(), '.context-mapper-mcp', 'cli');
}

/**
 * Get the default output directory
 */
export function getDefaultOutputDir(): string {
  return join(process.cwd(), 'generated');
}

/**
 * Get the bundled templates directory
 */
export function getTemplatesDir(): string {
  return join(PACKAGE_ROOT, 'src', 'templates');
}

/**
 * Current CLI configuration (singleton)
 */
let currentConfig: CLIConfig = {
  cliDir: getDefaultCLIDir(),
  version: DEFAULT_CLI_VERSION,
  javaHome: process.env.JAVA_HOME || null,
  outputDir: getDefaultOutputDir(),
  timeout: DEFAULT_CLI_TIMEOUT,
  templatesDir: getTemplatesDir(),
};

/**
 * Get the current CLI configuration
 */
export function getCLIConfig(): CLIConfig {
  return { ...currentConfig };
}

/**
 * Update CLI configuration
 * @param updates Partial configuration to merge
 */
export function setCLIConfig(updates: Partial<CLIConfig>): CLIConfig {
  currentConfig = { ...currentConfig, ...updates };
  return getCLIConfig();
}

/**
 * Reset CLI configuration to defaults
 */
export function resetCLIConfig(): CLIConfig {
  currentConfig = {
    cliDir: getDefaultCLIDir(),
    version: DEFAULT_CLI_VERSION,
    javaHome: process.env.JAVA_HOME || null,
    outputDir: getDefaultOutputDir(),
    timeout: DEFAULT_CLI_TIMEOUT,
    templatesDir: getTemplatesDir(),
  };
  return getCLIConfig();
}

/**
 * Get the directory for a specific CLI version
 */
export function getCLIVersionDir(version: string = currentConfig.version): string {
  return join(currentConfig.cliDir, version);
}

/**
 * Get the CLI executable path
 */
export function getCLIExecutablePath(version: string = currentConfig.version): string {
  const versionDir = getCLIVersionDir(version);
  const executable = platform() === 'win32' ? 'cm.bat' : 'cm';
  return join(versionDir, 'bin', executable);
}

/**
 * Get the Java executable path
 */
export function getJavaExecutablePath(): string {
  if (currentConfig.javaHome) {
    const executable = platform() === 'win32' ? 'java.exe' : 'java';
    return join(currentConfig.javaHome, 'bin', executable);
  }
  // Fall back to PATH
  return 'java';
}

/**
 * Get download URL for CLI archive
 * @param version CLI version
 */
export function getCLIDownloadUrl(version: string = currentConfig.version): string {
  const extension = platform() === 'win32' ? 'zip' : 'tar';
  return `${MAVEN_BASE_URL}/${version}/context-mapper-cli-${version}.${extension}`;
}

/**
 * Get the current platform type
 */
export function getPlatformType(): 'windows' | 'unix' {
  return platform() === 'win32' ? 'windows' : 'unix';
}

/**
 * Check if we're running on Windows
 */
export function isWindows(): boolean {
  return platform() === 'win32';
}

/**
 * Configuration for bundled template lookup
 */
export interface BundledTemplateInfo {
  name: string;
  path: string;
  description: string;
  outputExtension: string;
}

/**
 * Get information about bundled templates
 */
export function getBundledTemplates(): BundledTemplateInfo[] {
  const templatesDir = currentConfig.templatesDir;
  return [
    {
      name: 'glossary',
      path: join(templatesDir, 'GlossaryTemplate.md.ftl'),
      description: 'Ubiquitous language glossary',
      outputExtension: 'md',
    },
    {
      name: 'jhipster-microservices',
      path: join(templatesDir, 'JHipster-Microservices.jdl.ftl'),
      description: 'JHipster microservices architecture',
      outputExtension: 'jdl',
    },
    {
      name: 'jhipster-monolith',
      path: join(templatesDir, 'JHipster-Monolith.jdl.ftl'),
      description: 'JHipster monolithic application',
      outputExtension: 'jdl',
    },
    {
      name: 'full-report',
      path: join(templatesDir, 'FullReportTemplate.md.ftl'),
      description: 'Comprehensive domain documentation',
      outputExtension: 'md',
    },
  ];
}

/**
 * Get a bundled template by name
 */
export function getBundledTemplate(name: string): BundledTemplateInfo | undefined {
  return getBundledTemplates().find(t => t.name === name);
}
