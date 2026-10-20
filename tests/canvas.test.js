/**
 * Tests for Bounded Context Canvas support and the HTML generators
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleCml = fs.readFileSync(path.join(__dirname, 'sample.cml'), 'utf-8');

const { parseCML } = await import('../dist/model/parser.js');
const { serializeCML } = await import('../dist/model/writer.js');
const canvasModule = await import('../dist/model/canvas.js');
const modelTools = await import('../dist/tools/model-tools.js');
const canvasTools = await import('../dist/tools/canvas-tools.js');
const { renderCanvasHtml } = await import('../dist/generators/html/canvas-html.js');
const { renderContextMapHtml } = await import('../dist/generators/html/context-map-html.js');

function loadSample() {
  const result = parseCML(sampleCml);
  assert.strictEqual(result.success, true);
  return result.model;
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cml-canvas-'));
}

describe('CML round-trip', () => {
  test('should re-parse a serialized model with escaped keywords and symmetric relationships', () => {
    const reparsed = parseCML(serializeCML(loadSample()));
    assert.strictEqual(reparsed.success, true, JSON.stringify(reparsed.errors));

    const product = reparsed.model.boundedContexts.find(bc => bc.name === 'Inventory').aggregates[0].entities[0];
    assert.ok(product.attributes.some(a => a.name === 'name'), 'escaped ^name should parse as name');

    const partnership = reparsed.model.contextMap.relationships.find(r => r.type === 'Partnership');
    assert.ok(partnership, 'partnership should survive the round-trip');
  });
});

describe('Canvas derivation', () => {
  test('should derive purpose, communication and ubiquitous language from the model', () => {
    const model = loadSample();
    const bc = model.boundedContexts.find(c => c.name === 'OrderManagement');
    const canvas = canvasModule.resolveCanvas(model, bc);

    assert.strictEqual(canvas.purpose, 'Handles order processing and lifecycle');

    // Downstream of CustomerManagement: receives its events
    const fromCustomers = canvas.inboundCommunication.find(c => c.collaborator === 'CustomerManagement');
    assert.deepStrictEqual(fromCustomers.messages, [{ type: 'event', name: 'CustomerRegistered' }]);
    assert.match(fromCustomers.relationship, /^upstream: open host service, published language \(this context: anticorruption layer\)$/);

    // Upstream of Shipping: publishes events to it
    const toShipping = canvas.outboundCommunication.find(c => c.collaborator === 'Shipping');
    assert.ok(toShipping.messages.some(m => m.type === 'event' && m.name === 'OrderPlaced'));

    // Commands are not attributed to downstreams unless aggregates are exposed
    assert.ok(!canvas.inboundCommunication.some(c => c.collaborator === 'Shipping'));

    assert.ok(canvas.ubiquitousLanguage.some(t => t.term === 'OrderLine'));
  });

  test('should attribute commands to downstreams of exposed aggregates', () => {
    const model = loadSample();
    const rel = model.contextMap.relationships.find(r => r.type === 'UpstreamDownstream' && r.downstream === 'Shipping');
    rel.exposedAggregates = ['Order'];
    const bc = model.boundedContexts.find(c => c.name === 'OrderManagement');
    const canvas = canvasModule.resolveCanvas(model, bc);

    const fromShipping = canvas.inboundCommunication.find(c => c.collaborator === 'Shipping');
    assert.ok(fromShipping.messages.every(m => m.type === 'command'));
    assert.ok(fromShipping.messages.length > 0);
  });

  test('should place symmetric partners in both directions', () => {
    const model = loadSample();
    const bc = model.boundedContexts.find(c => c.name === 'Inventory');
    const canvas = canvasModule.resolveCanvas(model, bc);
    assert.ok(canvas.inboundCommunication.some(c => c.collaborator === 'Shipping' && c.relationship === 'partnership'));
    assert.ok(canvas.outboundCommunication.some(c => c.collaborator === 'Shipping' && c.relationship === 'partnership'));
  });

  test('explicit entries should override derived ones', () => {
    const model = loadSample();
    const bc = model.boundedContexts.find(c => c.name === 'OrderManagement');
    bc.canvas = {
      purpose: 'Take orders',
      inboundCommunication: [{ collaborator: 'CustomerManagement', relationship: 'customer/supplier', messages: [] }],
      ubiquitousLanguage: [{ term: 'orderline', definition: 'One product in an order' }],
    };
    const canvas = canvasModule.resolveCanvas(model, bc);

    assert.strictEqual(canvas.purpose, 'Take orders');
    const customers = canvas.inboundCommunication.filter(c => c.collaborator === 'CustomerManagement');
    assert.strictEqual(customers.length, 1);
    assert.strictEqual(customers[0].relationship, 'customer/supplier');
    assert.strictEqual(canvas.ubiquitousLanguage.filter(t => t.term.toLowerCase() === 'orderline').length, 1);
  });

  test('deriveFromModel=false should return only stored data', () => {
    const model = loadSample();
    const bc = model.boundedContexts.find(c => c.name === 'OrderManagement');
    const canvas = canvasModule.resolveCanvas(model, bc, false);
    assert.deepStrictEqual(canvas, { name: 'OrderManagement' });
  });
});

describe('Canvas sidecar format', () => {
  test('should round-trip canvases through the multi-document YAML sidecar', () => {
    const model = loadSample();
    const bc = model.boundedContexts.find(c => c.name === 'Shipping');
    bc.canvas = {
      strategicClassification: { domain: ['supporting'], businessModel: ['revenue', 'compliance'] },
      domainRoles: ['execution context'],
      outboundCommunication: [{ collaborator: 'Carrier', type: 'external system', messages: [{ type: 'command', name: 'Book Shipment' }] }],
      assumptions: ['One carrier per country'],
    };

    const yaml = canvasModule.serializeCanvasSidecar(model);
    assert.ok(yaml.includes('business_model:'), 'should use canonical snake_case keys');
    assert.ok(yaml.includes('domain: supporting'), 'single values should be scalars');

    const { canvases, errors } = canvasModule.parseCanvasSidecar(yaml);
    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(canvases.get('Shipping'), bc.canvas);
  });

  test('should return null when no context has canvas data', () => {
    assert.strictEqual(canvasModule.serializeCanvasSidecar(loadSample()), null);
  });

  test('should report unknown keys and invalid enum values', () => {
    const { errors } = canvasModule.parseCanvasSidecar(
      'name: Payments\nubiquitous_langauge: []\nstrategic_classification:\n  evolution: genesys\n'
    );
    assert.ok(errors.some(e => e.includes('unknown key "ubiquitous_langauge"')));
    assert.ok(errors.some(e => e.includes('unknown value "genesys"')));
  });

  test('should accept the DDD Crew example format', () => {
    const { canvases, errors } = canvasModule.parseCanvasSidecar(
      [
        'name: Payments',
        'strategic_classification:',
        '  domain: supporting',
        '  business_model: [revenue, compliance]',
        'inbound_communication:',
        '  - collaborator: Checkout',
        '    type: bounded context',
        '    messages:',
        '      - { type: command, name: Authorize Payment }',
        'ubiquitous_language:',
        '  - Capture',
        '  - term: Chargeback',
        '    definition: A reversed payment',
      ].join('\n')
    );
    assert.deepStrictEqual(errors, []);
    const canvas = canvases.get('Payments');
    assert.deepStrictEqual(canvas.strategicClassification.businessModel, ['revenue', 'compliance']);
    assert.deepStrictEqual(canvas.ubiquitousLanguage[0], { term: 'Capture' });
  });
});

describe('Canvas tools', () => {
  test('should set, validate, persist and reload canvas data', async () => {
    const dir = tempDir();
    const cmlPath = path.join(dir, 'shop.cml');
    fs.writeFileSync(cmlPath, sampleCml);

    assert.strictEqual((await modelTools.loadModel({ path: cmlPath })).success, true);

    const bad = canvasTools.setBoundedContextCanvas({ contextName: 'Inventory', strategicClassification: { domain: 'corez' } });
    assert.strictEqual(bad.success, false);
    assert.ok(bad.errors[0].includes('corez'));

    const ok = canvasTools.setBoundedContextCanvas({
      contextName: 'Inventory',
      strategicClassification: { domain: 'generic', evolution: 'product' },
      openQuestions: ['Do we track batches?'],
      ubiquitousLanguage: ['Stock Level'],
    });
    assert.strictEqual(ok.success, true, JSON.stringify(ok));

    const saved = await modelTools.saveModel({});
    assert.strictEqual(saved.success, true);
    assert.ok(fs.existsSync(path.join(dir, 'shop.canvas.yaml')));

    const loaded = await modelTools.loadModel({ path: cmlPath });
    assert.strictEqual(loaded.success, true, JSON.stringify(loaded));
    const got = canvasTools.getBoundedContextCanvas({ contextName: 'Inventory', deriveFromModel: false });
    assert.deepStrictEqual(got.canvas, {
      name: 'Inventory',
      strategic_classification: { domain: 'generic', evolution: 'product' },
      ubiquitous_language: [{ term: 'Stock Level' }],
      open_questions: ['Do we track batches?'],
    });

    // Clearing every section removes the sidecar on the next save
    canvasTools.setBoundedContextCanvas({ contextName: 'Inventory', replace: true });
    await modelTools.saveModel({});
    assert.ok(!fs.existsSync(path.join(dir, 'shop.canvas.yaml')));
  });

  test('should generate linked HTML context map and canvases', async () => {
    const dir = tempDir();
    const cmlPath = path.join(dir, 'shop.cml');
    fs.writeFileSync(cmlPath, sampleCml);
    await modelTools.loadModel({ path: cmlPath });

    const result = await canvasTools.generateContextMapHtmlTool({ outputDir: path.join(dir, 'site') });
    assert.strictEqual(result.success, true, JSON.stringify(result));
    assert.strictEqual(result.outputs.length, 5);

    const map = fs.readFileSync(path.join(dir, 'site', 'context-map.html'), 'utf-8');
    assert.ok(map.includes('canvases/OrderManagement.html'));
    assert.ok(map.includes('U · OHS · PL'));

    const canvas = fs.readFileSync(path.join(dir, 'site', 'canvases', 'Shipping.html'), 'utf-8');
    assert.ok(canvas.includes('href="../context-map.html"'));

    const yaml = await canvasTools.generateBoundedContextCanvasTool({ contextName: 'Shipping', format: 'yaml', outputDir: path.join(dir, 'yaml') });
    assert.strictEqual(yaml.success, true);
    assert.ok(fs.readFileSync(path.join(dir, 'yaml', 'Shipping.yaml'), 'utf-8').startsWith('# yaml-language-server: $schema='));

    const missing = await canvasTools.generateBoundedContextCanvasTool({ contextName: 'Nope', outputDir: dir });
    assert.strictEqual(missing.success, false);
  });
});

describe('HTML rendering', () => {
  test('canvas page should escape user content and show guidance for empty sections', () => {
    const html = renderCanvasHtml({ name: 'X<script>alert(1)</script>', businessDecisions: ['a & b'] });
    assert.ok(!html.includes('<script>alert(1)'));
    assert.ok(html.includes('X&lt;script&gt;'));
    assert.ok(html.includes('a &amp; b'));
    assert.ok(html.includes('What benefits does this context provide'));
  });

  test('context map page should embed data safely and work without a context map', () => {
    const model = loadSample();
    model.boundedContexts[0].domainVisionStatement = '</script><img src=x>';
    const html = renderContextMapHtml(model);
    const dataScript = html.match(/<script type="application\/json" id="cm-data">([\s\S]*?)<\/script>/)[1];
    assert.ok(!dataScript.includes('</script'));
    assert.ok(JSON.parse(dataScript).contexts.length === 4);

    delete model.contextMap;
    const noMap = renderContextMapHtml(model);
    assert.ok(noMap.includes('4 bounded contexts'));

    const empty = renderContextMapHtml({ name: 'Empty', boundedContexts: [] });
    assert.ok(empty.includes('no bounded contexts yet'));
  });
});
