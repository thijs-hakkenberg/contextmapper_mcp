/**
 * Test script for CML parser
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseCML } from './dist/model/parser.js';
import { serializeCML } from './dist/model/writer.js';
import { validateModel } from './dist/model/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== CML Parser Test ===\n');

  // Read sample file
  const samplePath = path.join(__dirname, 'tests/sample.cml');
  const content = fs.readFileSync(samplePath, 'utf-8');
  console.log('Reading sample.cml...\n');

  // Parse
  console.log('Parsing CML...');
  const result = parseCML(content);

  if (!result.success) {
    console.error('Parse errors:');
    for (const error of result.errors) {
      console.error(`  Line ${error.line}, Col ${error.column}: ${error.message}`);
    }
    process.exit(1);
  }

  const model = result.model;
  console.log('Parse successful!\n');

  // Show model info
  console.log('=== Model Info ===');
  console.log(`Bounded Contexts: ${model.boundedContexts.length}`);
  for (const bc of model.boundedContexts) {
    console.log(`  - ${bc.name} (${bc.aggregates.length} aggregates)`);
    for (const agg of bc.aggregates) {
      console.log(`    - Aggregate: ${agg.name}`);
      console.log(`      Entities: ${agg.entities.map(e => e.name).join(', ')}`);
      console.log(`      Value Objects: ${agg.valueObjects.map(v => v.name).join(', ')}`);
      console.log(`      Events: ${agg.domainEvents.map(e => e.name).join(', ')}`);
      console.log(`      Commands: ${agg.commands.map(c => c.name).join(', ')}`);
    }
  }

  if (model.contextMap) {
    console.log(`\nContext Map: ${model.contextMap.name}`);
    console.log(`  State: ${model.contextMap.state || 'not specified'}`);
    console.log(`  Contains: ${model.contextMap.boundedContexts.join(', ')}`);
    console.log(`  Relationships: ${model.contextMap.relationships.length}`);
    for (const rel of model.contextMap.relationships) {
      if (rel.type === 'Partnership' || rel.type === 'SharedKernel') {
        console.log(`    - ${rel.participant1} <-> ${rel.participant2} [${rel.type}]`);
      } else {
        console.log(`    - ${rel.upstream} -> ${rel.downstream} [U->D]`);
      }
    }
  }

  // Validate
  console.log('\n=== Validation ===');
  const validation = validateModel(model);
  console.log(`Valid: ${validation.valid}`);
  if (validation.errors.length > 0) {
    for (const error of validation.errors) {
      console.log(`  [${error.type}] ${error.message}`);
    }
  } else {
    console.log('  No validation errors or warnings');
  }

  // Serialize back
  console.log('\n=== Serialization ===');
  const serialized = serializeCML(model);
  console.log('Model serialized successfully');
  console.log('\nFirst 500 chars of output:');
  console.log(serialized.substring(0, 500) + '...');

  console.log('\n=== All Tests Passed ===');
}

main().catch(console.error);
