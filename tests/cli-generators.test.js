/**
 * Tests for CLI generators
 * These tests verify the generator infrastructure without requiring Java/CLI
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Generator Registry', async () => {
  const { getGeneratorRegistry, resetGeneratorRegistry } = await import('../dist/generators/registry.js');

  after(() => {
    resetGeneratorRegistry();
  });

  test('should create a singleton registry', () => {
    const registry1 = getGeneratorRegistry();
    const registry2 = getGeneratorRegistry();
    assert.strictEqual(registry1, registry2, 'Should return the same instance');
  });

  test('should register and retrieve generators', async () => {
    const { PlantUMLContextMapGenerator } = await import('../dist/generators/builtin/plantuml-adapter.js');
    const registry = getGeneratorRegistry();

    const generator = new PlantUMLContextMapGenerator();
    registry.register(generator);

    assert.ok(registry.has('plantuml-context-map'), 'Generator should be registered');
    assert.strictEqual(registry.get('plantuml-context-map'), generator);
  });

  test('should throw on duplicate registration', async () => {
    const { PlantUMLContextMapGenerator } = await import('../dist/generators/builtin/plantuml-adapter.js');
    const registry = getGeneratorRegistry();

    // Clear and re-register
    registry.unregister('plantuml-context-map');
    const generator = new PlantUMLContextMapGenerator();
    registry.register(generator);

    assert.throws(() => {
      registry.register(generator);
    }, /already registered/);
  });
});

describe('Generator Interfaces', async () => {
  const { createSuccessResult, createErrorResult } = await import('../dist/generators/interfaces.js');

  test('should create success result', () => {
    const outputs = [
      { type: 'content', content: 'test', format: 'txt' }
    ];
    const result = createSuccessResult(outputs);

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.outputs, outputs);
  });

  test('should create error result', () => {
    const result = createErrorResult('CLI_NOT_FOUND', 'CLI not found', 'Install CLI');

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.type, 'CLI_NOT_FOUND');
    assert.strictEqual(result.error.message, 'CLI not found');
    assert.strictEqual(result.error.suggestion, 'Install CLI');
  });
});

describe('PlantUML Generators', async () => {
  const { PlantUMLContextMapGenerator, PlantUMLAggregateGenerator, PlantUMLFullModelGenerator } =
    await import('../dist/generators/builtin/plantuml-adapter.js');

  test('should generate context map diagram', async () => {
    const generator = new PlantUMLContextMapGenerator();

    const model = {
      name: 'TestModel',
      boundedContexts: [
        { name: 'ContextA', aggregates: [], modules: [] },
        { name: 'ContextB', aggregates: [], modules: [] }
      ]
    };

    const result = await generator.generate(model);

    assert.strictEqual(result.success, true);
    assert.ok(result.outputs.length > 0);
    assert.ok(result.outputs[0].content.includes('@startuml'));
    assert.ok(result.outputs[0].content.includes('ContextA'));
  });

  test('should generate aggregate diagram', async () => {
    const generator = new PlantUMLAggregateGenerator();

    const model = {
      name: 'TestModel',
      boundedContexts: [
        {
          name: 'OrderContext',
          aggregates: [
            {
              name: 'Order',
              entities: [
                { name: 'Order', aggregateRoot: true, attributes: [] }
              ],
              valueObjects: [
                { name: 'Address', attributes: [{ name: 'street', type: 'String' }] }
              ],
              domainEvents: [],
              commands: [],
              services: []
            }
          ],
          modules: []
        }
      ]
    };

    const result = await generator.generate(model, {
      contextName: 'OrderContext',
      aggregateName: 'Order'
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.outputs[0].content.includes('Order'));
    assert.ok(result.outputs[0].content.includes('Address'));
  });

  test('should fail for missing context', async () => {
    const generator = new PlantUMLAggregateGenerator();

    const model = {
      name: 'TestModel',
      boundedContexts: []
    };

    const result = await generator.generate(model, {
      contextName: 'NonExistent',
      aggregateName: 'Test'
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.error.message.includes('not found'));
  });
});

describe('CLI Configuration', async () => {
  const { getCLIConfig, setCLIConfig, resetCLIConfig } = await import('../dist/generators/cli/config.js');

  after(() => {
    resetCLIConfig();
  });

  test('should have default configuration', () => {
    const config = getCLIConfig();

    assert.ok(config.cliDir);
    assert.ok(config.version);
    assert.ok(config.timeout > 0);
  });

  test('should allow configuration updates', () => {
    const newConfig = setCLIConfig({ timeout: 60000 });

    assert.strictEqual(newConfig.timeout, 60000);
  });

  test('should reset configuration to defaults', () => {
    setCLIConfig({ timeout: 99999 });
    const config = resetCLIConfig();

    assert.notStrictEqual(config.timeout, 99999);
  });
});

describe('Temp Files', async () => {
  const { createTempDir, createTempCMLFile, cleanupTemp, TempFileContext } =
    await import('../dist/utils/temp-files.js');
  const fs = await import('fs/promises');

  test('should create temp directory', async () => {
    const dir = await createTempDir();

    const stat = await fs.stat(dir);
    assert.ok(stat.isDirectory());

    await cleanupTemp(dir);
  });

  test('should create temp CML file', async () => {
    const content = 'BoundedContext Test {}';
    const filePath = await createTempCMLFile(content);

    const readContent = await fs.readFile(filePath, 'utf-8');
    assert.strictEqual(readContent, content);

    await cleanupTemp(filePath);
  });

  test('should manage temp files with context', async () => {
    const context = new TempFileContext();

    const dir = await context.createDir();
    const file = await context.createCMLFile('test content', dir);

    // Verify files exist
    const dirStat = await fs.stat(dir);
    assert.ok(dirStat.isDirectory());

    // Cleanup
    await context.cleanup();

    // Verify cleanup
    try {
      await fs.stat(dir);
      assert.fail('Directory should be deleted');
    } catch (e) {
      assert.strictEqual(e.code, 'ENOENT');
    }
  });
});

describe('Bundled Templates', async () => {
  const { getBundledTemplates, getBundledTemplate } = await import('../dist/generators/cli/config.js');
  const fs = await import('fs/promises');

  test('should list bundled templates', () => {
    const templates = getBundledTemplates();

    assert.ok(templates.length >= 4);
    assert.ok(templates.find(t => t.name === 'glossary'));
    assert.ok(templates.find(t => t.name === 'jhipster-microservices'));
    assert.ok(templates.find(t => t.name === 'full-report'));
  });

  test('should get template by name', () => {
    const glossary = getBundledTemplate('glossary');

    assert.ok(glossary);
    assert.strictEqual(glossary.name, 'glossary');
    assert.strictEqual(glossary.outputExtension, 'md');
  });

  test('should return undefined for unknown template', () => {
    const result = getBundledTemplate('nonexistent');

    assert.strictEqual(result, undefined);
  });
});

describe('CLI Tools', async () => {
  const { configureCLITool, resetCLIConfigTool } = await import('../dist/tools/cli-tools.js');
  const { resetCLIConfig } = await import('../dist/generators/cli/config.js');

  after(() => {
    resetCLIConfig();
  });

  test('should configure CLI settings', () => {
    const result = configureCLITool({ timeout: 120000 });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.config.timeout, 120000);
  });

  test('should reject invalid timeout', () => {
    const result = configureCLITool({ timeout: 100 });

    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('1000'));
  });

  test('should reset CLI config', () => {
    configureCLITool({ timeout: 999999 });
    const result = resetCLIConfigTool();

    assert.strictEqual(result.success, true);
    assert.notStrictEqual(result.config.timeout, 999999);
  });
});
