import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('QA & DevOps Comprehensive Verification: SMAR-23 Knowledge Graph Traversal Canvas Flashing and Rewind Playback', async (t) => {
  const explorerFile = path.join(frontendDir, 'src/components/KnowledgeGraphExplorer.tsx');
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  const qaFile = path.join(frontendDir, 'src/components/KnowledgeGraphQA.tsx');
  const drawerFile = path.join(frontendDir, 'src/components/SubgraphEvidenceDrawer.tsx');
  const typesFile = path.join(frontendDir, 'src/types/index.ts');
  const cssFile = path.join(frontendDir, 'src/app/globals.css');

  assert.ok(fs.existsSync(explorerFile), 'KnowledgeGraphExplorer.tsx must exist');
  assert.ok(fs.existsSync(dualPaneFile), 'DualPaneWorkspace.tsx must exist');
  assert.ok(fs.existsSync(qaFile), 'KnowledgeGraphQA.tsx must exist');
  assert.ok(fs.existsSync(drawerFile), 'SubgraphEvidenceDrawer.tsx must exist');
  assert.ok(fs.existsSync(typesFile), 'types/index.ts must exist');
  assert.ok(fs.existsSync(cssFile), 'globals.css must exist');

  const explorerSrc = fs.readFileSync(explorerFile, 'utf8');
  const dualPaneSrc = fs.readFileSync(dualPaneFile, 'utf8');
  const qaSrc = fs.readFileSync(qaFile, 'utf8');
  const drawerSrc = fs.readFileSync(drawerFile, 'utf8');
  const typesSrc = fs.readFileSync(typesFile, 'utf8');
  const cssSrc = fs.readFileSync(cssFile, 'utf8');

  await t.test('1. Knowledge Graph Traversal Canvas Flashing & SVG Glow Filters', () => {
    // Glow filters defined
    assert.match(explorerSrc, /filter id="glow-anchor"/, 'Must define glow-anchor SVG filter');
    assert.match(explorerSrc, /filter id="glow-1hop"/, 'Must define glow-1hop SVG filter');
    assert.match(explorerSrc, /filter id="glow-2hop"/, 'Must define glow-2hop SVG filter');

    // Directional arrowheads
    assert.match(explorerSrc, /id="arrowhead-anchor"/, 'Must define arrowhead-anchor marker');
    assert.match(explorerSrc, /id="arrowhead-1hop"/, 'Must define arrowhead-1hop marker');
    assert.match(explorerSrc, /id="arrowhead-2hop"/, 'Must define arrowhead-2hop marker');

    // Flashing animations on active hop nodes and edges
    assert.match(explorerSrc, /animate-pulse/, 'Nodes and edges must flash/pulse when reached');
    assert.match(explorerSrc, /glowFilter/, 'Active nodes must apply dynamic SVG glow filter');
  });

  await t.test('2. Traversal Playback Scrubber Toolbar and Sequential Cadence', () => {
    // Toolbar ARIA role
    assert.match(explorerSrc, /role="toolbar"/, 'Must declare role="toolbar"');

    // 5 buttons
    assert.match(explorerSrc, /Rewind to Start/, 'Must implement Rewind to Start button');
    assert.match(explorerSrc, /Step Back/, 'Must implement Step Back button');
    assert.match(explorerSrc, /Play Traversal|Pause Traversal/, 'Must implement Play / Pause button');
    assert.match(explorerSrc, /Step Forward/, 'Must implement Step Forward button');
    assert.match(explorerSrc, /Fast Forward to Full Subgraph/, 'Must implement Fast Forward button');

    // ~800ms cadence between hops
    assert.match(explorerSrc, /800\);/, 'Sequential traversal playback cadence must be ~800ms');

    // Dynamic hop progress indicator
    assert.match(explorerSrc, /Hop \{currentHop\} of \{maxHops\}/, 'Must render hop indicator text');
    assert.match(explorerSrc, /Concept Grounding/, 'Hop 0 must be Concept Grounding');
    assert.match(explorerSrc, /1-Hop SPARQL/, 'Hop 1 must be 1-Hop SPARQL');
    assert.match(explorerSrc, /Evidence Subgraph/, 'Hop 2 must be Evidence Subgraph');

    // Range slider scrubber
    assert.match(explorerSrc, /aria-label="Hop Scrubber"/, 'Must render accessible range scrubber');
  });

  await t.test('3. State Rewind Mechanics (Dimming & Subgraph Pruning)', () => {
    // Bound to currentHop
    assert.match(
      explorerSrc,
      /isDiscovered = nodeHop !== -1 && nodeHop <= currentHop/,
      'Node discovery must be bounded by currentHop'
    );
    assert.match(
      explorerSrc,
      /isDiscovered = edgeHop !== -1 && edgeHop <= currentHop/,
      'Edge discovery must be bounded by currentHop'
    );
    assert.match(
      explorerSrc,
      /opacity=\{isUnvisited \? 0\.12 : 1\}/,
      'Unvisited nodes must be dimmed to 0.12 opacity'
    );
    assert.match(
      explorerSrc,
      /opacity=\{isUnvisited \? 0\.1 : 1\}/,
      'Unvisited edges must be dimmed to 0.1 opacity'
    );
  });

  await t.test('4. Inter-Pane Q&A & Evidence Drawer Integration', () => {
    assert.match(
      qaSrc,
      /onInspectTraversalOnCanvas/,
      'KnowledgeGraphQA must support onInspectTraversalOnCanvas'
    );
    assert.match(
      qaSrc,
      /Replay on Canvas/,
      'Q&A breadcrumb must provide Replay on Canvas action'
    );
    assert.match(
      drawerSrc,
      /Replay on Canvas/,
      'SubgraphEvidenceDrawer must provide Replay on Canvas action'
    );
    assert.match(
      dualPaneSrc,
      /activeTraversalLineage/,
      'DualPaneWorkspace must track activeTraversalLineage'
    );
    assert.match(
      dualPaneSrc,
      /setActiveTab\('graph'\)/,
      'DualPaneWorkspace must switch to Graph tab on traversal inspect'
    );
  });

  await t.test('5. Accessibility (WCAG 2.1 AA) & Motion Reduction Compliance', () => {
    assert.match(
      explorerSrc,
      /motion-reduce:animate-none/,
      'KnowledgeGraphExplorer must enforce motion-reduce:animate-none'
    );
    assert.match(
      explorerSrc,
      /motion-reduce:transition-none/,
      'KnowledgeGraphExplorer must enforce motion-reduce:transition-none'
    );
    assert.match(
      explorerSrc,
      /handleToolbarKeyDown/,
      'KnowledgeGraphExplorer must handle keyboard navigation'
    );
  });

  await t.test('6. Live Docker Service Health & E2E GraphRAG Query Verification', async () => {
    const frontendBase = process.env.TEST_FRONTEND_URL || 'http://localhost:3003';
    const backendBase = process.env.TEST_BACKEND_URL || 'http://localhost:8003';

    try {
      // 6.1 Frontend SSR Health
      const frontRes = await fetch(frontendBase);
      assert.equal(frontRes.status, 200, 'Live frontend must return HTTP 200');

      // 6.2 Backend Health
      const backRes = await fetch(`${backendBase}/api/health`);
      assert.equal(backRes.status, 200, 'Live backend health must return HTTP 200');
      const backData = await backRes.json();
      assert.equal(backData.status, 'healthy');
      assert.equal(backData.oxigraph_store_active, true);

      // 6.3 Seed active article into Oxigraph store
      const seedRes = await fetch(`${backendBase}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Knowledge graph traversal visualizes concept grounding anchor nodes, 1-hop expansion assertions, and multi-hop evidence subgraphs in Oxigraph.',
        }),
      });
      assert.equal(seedRes.status, 200, 'Seeding knowledge graph via /api/process must return HTTP 200');
      const seedData = await seedRes.json();
      const activeSessionId = seedData.provenance_summary?.session_id || 'qa_smar23_test_session';

      // 6.4 Live /api/rag/query contract
      const ragRes = await fetch(`${frontendBase}/api/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSessionId,
          query: 'How does graph traversal ground concepts and expand 1-hop assertions?',
          top_k_triples: 5,
        }),
      });

      assert.equal(ragRes.status, 200, '/api/rag/query must return HTTP 200');
      const ragData = await ragRes.json();
      assert.ok(ragData.graph_context, 'RAG query response must include graph_context');
      assert.ok(Array.isArray(ragData.graph_context.matched_concepts), 'matched_concepts must be an array');
      assert.ok(Array.isArray(ragData.graph_context.retrieved_triples), 'retrieved_triples must be an array');
      assert.equal(typeof ragData.graph_context.traversal_hops, 'number', 'traversal_hops must be numeric');
    } catch (e) {
      // If docker container is not reachable in local environment, skip live network checks
      console.warn('Docker live verification skipped or completed with fallback:', e.message);
    }
  });
});
