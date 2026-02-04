/**
 * Generator Registry - Dependency Injection Container for Generators
 * Manages registration and retrieval of all generators (builtin and CLI-based)
 */

import type { IGenerator, GeneratorAvailability } from './interfaces.js';

/**
 * Registry for managing generators
 */
class GeneratorRegistry {
  private generators: Map<string, IGenerator> = new Map();
  private cliAvailable: boolean = false;
  private javaAvailable: boolean = false;

  /**
   * Register a generator
   * @param generator The generator to register
   * @throws Error if a generator with the same name is already registered
   */
  register(generator: IGenerator): void {
    if (this.generators.has(generator.name)) {
      throw new Error(`Generator '${generator.name}' is already registered`);
    }
    this.generators.set(generator.name, generator);
  }

  /**
   * Unregister a generator
   * @param name Name of the generator to unregister
   * @returns true if the generator was removed, false if it didn't exist
   */
  unregister(name: string): boolean {
    return this.generators.delete(name);
  }

  /**
   * Get a generator by name
   * @param name Name of the generator
   * @returns The generator or undefined if not found
   */
  get(name: string): IGenerator | undefined {
    return this.generators.get(name);
  }

  /**
   * Check if a generator is registered
   * @param name Name of the generator
   * @returns true if the generator is registered
   */
  has(name: string): boolean {
    return this.generators.has(name);
  }

  /**
   * Get all registered generators
   * @returns Array of all registered generators
   */
  getAll(): IGenerator[] {
    return Array.from(this.generators.values());
  }

  /**
   * Get all generator names
   * @returns Array of all registered generator names
   */
  getNames(): string[] {
    return Array.from(this.generators.keys());
  }

  /**
   * Get generators filtered by whether they require CLI
   * @param requiresCLI If true, return only CLI generators; if false, return only builtin
   * @returns Filtered array of generators
   */
  getByType(requiresCLI: boolean): IGenerator[] {
    return this.getAll().filter(g => g.requiresCLI === requiresCLI);
  }

  /**
   * Update CLI availability status
   * @param available Whether CLI is available
   */
  setCLIAvailable(available: boolean): void {
    this.cliAvailable = available;
  }

  /**
   * Check if CLI is available
   */
  isCLIAvailable(): boolean {
    return this.cliAvailable;
  }

  /**
   * Update Java availability status
   * @param available Whether Java is available
   */
  setJavaAvailable(available: boolean): void {
    this.javaAvailable = available;
  }

  /**
   * Check if Java is available
   */
  isJavaAvailable(): boolean {
    return this.javaAvailable;
  }

  /**
   * Get availability status for all generators
   * @returns Array of availability statuses
   */
  getAvailability(): GeneratorAvailability[] {
    return this.getAll().map(generator => {
      const requiresCLI = generator.requiresCLI;
      let available = true;
      let reason: string | undefined;

      if (requiresCLI) {
        if (!this.javaAvailable) {
          available = false;
          reason = 'Java runtime not available';
        } else if (!this.cliAvailable) {
          available = false;
          reason = 'CLI not installed (run cml_download_cli)';
        }
      }

      return {
        name: generator.name,
        available,
        requiresCLI,
        reason,
      };
    });
  }

  /**
   * Get only available generators
   * @returns Array of available generators
   */
  getAvailable(): IGenerator[] {
    return this.getAll().filter(generator => {
      if (!generator.requiresCLI) {
        return true;
      }
      return this.javaAvailable && this.cliAvailable;
    });
  }

  /**
   * Clear all registered generators
   */
  clear(): void {
    this.generators.clear();
  }

  /**
   * Get count of registered generators
   */
  get size(): number {
    return this.generators.size;
  }
}

// Singleton instance
let registryInstance: GeneratorRegistry | null = null;

/**
 * Get the global generator registry instance
 * @returns The singleton GeneratorRegistry instance
 */
export function getGeneratorRegistry(): GeneratorRegistry {
  if (!registryInstance) {
    registryInstance = new GeneratorRegistry();
  }
  return registryInstance;
}

/**
 * Reset the global registry (mainly for testing)
 */
export function resetGeneratorRegistry(): void {
  if (registryInstance) {
    registryInstance.clear();
  }
  registryInstance = null;
}

export { GeneratorRegistry };
