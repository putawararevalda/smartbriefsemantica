import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('Knowledge Graph & Oxigraph Explorer Verification', async (t) => {
  const explorerFile = path.join(frontendDir, 'src/components/KnowledgeGraphExplorer.tsx');
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  const tripletsRoute = path.join(frontendDir, 'src/app/api/graph/triplets/route.ts');
  const sparqlRoute = path.join(frontendDir, 'src/app/api/graph/sparql/route.ts');
  const exportRoute = path.join(frontendDir, 'src/app/api/graph/export/route.ts');

  await t.test('1. Component and API Proxy Files Exist', () => {
    assert.ok(fs.existsSync(explorerFile), 'KnowledgeGraphExplorer.tsx must exist');
    assert.ok(fs.existsSync(tripletsRoute), 'api/graph/triplets/route.ts must exist');
    assert.ok(fs.existsSync(sparqlRoute), 'api/graph/sparql/route.ts must exist');
    assert.ok(fs.existsSync(exportRoute), 'api/graph/export/route.ts must exist');
  });

  const explorerSrc = fs.readFileSync(explorerFile, 'utf8');
  const dualPaneSrc = fs.readFileSync(dualPaneFile, 'utf8');

  await t.test('2. KnowledgeGraphExplorer implements all 4 sub-views', () => {
    // Sub-tab definitions
    assert.match(explorerSrc, /'visual'\s*\|\s*'triplets'\s*\|\s*'sparql'\s*\|\s*'export'/,
      'KnowledgeGraphExplorer must define visual, triplets, sparql, and export tabs');

    // Visual SVG canvas with directed edges and node clicking
    assert.match(explorerSrc, /<svg[^>]*viewBox="0 0 720 480"/, 'Visual view must render 720x480 SVG canvas');
    assert.match(explorerSrc, /<marker[\s\S]*?id="arrowhead"/, 'Visual view must render directed arrowheads');
    assert.match(explorerSrc, /setSelectedNodeId/, 'Visual view must support node clicking to inspect connections');

    // Triplestore data table
    assert.match(explorerSrc, /Subject \(URI\)/, 'Triplestore view must show Subject column');
    assert.match(explorerSrc, /Predicate/, 'Triplestore view must show Predicate column');
    assert.match(explorerSrc, /Object \/ Literal/, 'Triplestore view must show Object column');

    // Interactive SPARQL Runner
    assert.match(explorerSrc, /PRESET_SPARQL_QUERIES/, 'SPARQL runner must provide pre-built query templates');
    assert.match(explorerSrc, /handleExecuteSparql/, 'SPARQL runner must execute queries via /api/graph/sparql');

    // W3C Turtle Exporter
    assert.match(explorerSrc, /handleCopyTurtle/, 'Exporter must provide copy to clipboard');
    assert.match(explorerSrc, /handleDownloadTurtle/, 'Exporter must provide .ttl download');
  });

  await t.test('3. DualPaneWorkspace integrates Graph Tab and Panel', () => {
    // Tab Button
    assert.match(dualPaneSrc, /id="tab-graph"/, 'DualPaneWorkspace must render tab-graph button');
    assert.match(dualPaneSrc, /aria-controls="tabpanel-graph"/, 'tab-graph must control tabpanel-graph');
    assert.match(dualPaneSrc, /aria-selected=\{activeTab === 'graph'\}/, 'tab-graph must reflect activeTab === graph');

    // Tab Panel
    assert.match(dualPaneSrc, /id="tabpanel-graph"\s+role="tabpanel"\s+aria-labelledby="tab-graph"/,
      'DualPaneWorkspace must render tabpanel-graph');
    assert.match(dualPaneSrc, /<KnowledgeGraphExplorer/,
      'DualPaneWorkspace must embed KnowledgeGraphExplorer component');
  });

  await t.test('4. Live API Endpoints Contract (against running container)', async () => {
    const frontendBase = 'http://localhost:3003';

    // 1. GET /api/graph/triplets
    const tripRes = await fetch(`${frontendBase}/api/graph/triplets`);
    assert.strictEqual(tripRes.status, 200, '/api/graph/triplets must return HTTP 200');
    const tripData = await tripRes.json();
    assert.ok(typeof tripData.total_triplets === 'number', 'total_triplets must be a number');
    assert.ok(Array.isArray(tripData.triplets), 'triplets must be an array');

    // 2. POST /api/graph/sparql
    const sparqlRes = await fetch(`${frontendBase}/api/graph/sparql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 5' }),
    });
    assert.strictEqual(sparqlRes.status, 200, '/api/graph/sparql must return HTTP 200');
    const sparqlData = await sparqlRes.json();
    assert.strictEqual(sparqlData.success, true, 'SPARQL query execution must report success: true');
    assert.ok(Array.isArray(sparqlData.variables), 'SPARQL response must include variables array');
    assert.ok(Array.isArray(sparqlData.bindings), 'SPARQL response must include bindings array');

    // 3. GET /api/graph/export
    const exportRes = await fetch(`${frontendBase}/api/graph/export`);
    assert.strictEqual(exportRes.status, 200, '/api/graph/export must return HTTP 200');
    const exportData = await exportRes.json();
    assert.strictEqual(exportData.format, 'turtle', 'Export format must be turtle');
    assert.match(exportData.content, /@prefix rdf:/, 'Export content must contain RDF Turtle syntax');
  });
});
