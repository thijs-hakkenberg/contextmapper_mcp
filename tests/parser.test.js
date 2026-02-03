/**
 * Basic test to verify the parser works
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CML Parser', async () => {
  // Dynamic import of the compiled parser
  const { parseCML } = await import('../dist/model/parser.js');
  const { serializeCML } = await import('../dist/model/writer.js');
  const { validateModel } = await import('../dist/model/validation.js');

  test('should parse sample.cml successfully', () => {
    const samplePath = path.join(__dirname, 'sample.cml');
    const content = fs.readFileSync(samplePath, 'utf-8');

    const result = parseCML(content);

    assert.strictEqual(result.success, true, 'Parse should succeed');
    assert.ok(result.model, 'Model should be returned');
    assert.ok(result.model.boundedContexts.length > 0, 'Should have bounded contexts');
  });

  test('should serialize model to CML', () => {
    const samplePath = path.join(__dirname, 'sample.cml');
    const content = fs.readFileSync(samplePath, 'utf-8');

    const result = parseCML(content);
    assert.strictEqual(result.success, true);

    const serialized = serializeCML(result.model);
    assert.ok(serialized.length > 0, 'Serialized output should not be empty');
    assert.ok(serialized.includes('BoundedContext'), 'Should contain BoundedContext');
  });

  test('should validate model without errors', () => {
    const samplePath = path.join(__dirname, 'sample.cml');
    const content = fs.readFileSync(samplePath, 'utf-8');

    const result = parseCML(content);
    assert.strictEqual(result.success, true);

    const validation = validateModel(result.model);
    const errors = validation.errors.filter(e => e.type === 'ERROR');
    assert.strictEqual(errors.length, 0, 'Should have no validation errors');
  });
});
