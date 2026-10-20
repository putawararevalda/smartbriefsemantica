import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('QA & DevOps Comprehensive Verification: SMAR-18 Knowledge Graph Default View & Study Deck Mode Toggle', async (t) => {
  const dualPanePath = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  const explorerPath = path.join(frontendDir, 'src/components/KnowledgeGraphExplorer.tsx');
  const ingestionPath = path.join(frontendDir, 'src/components/IngestionHub.tsx');
  const stepperPath = path.join(frontendDir, 'src/components/ProgressStepper.tsx');

  assert.ok(fs.existsSync(dualPanePath), 'DualPaneWorkspace.tsx must exist');
  assert.ok(fs.existsSync(explorerPath), 'KnowledgeGraphExplorer.tsx must exist');
  assert.ok(fs.existsSync(ingestionPath), 'IngestionHub.tsx must exist');
  assert.ok(fs.existsSync(stepperPath), 'ProgressStepper.tsx must exist');

  const dualPaneSrc = fs.readFileSync(dualPanePath, 'utf8');
  const explorerSrc = fs.readFileSync(explorerPath, 'utf8');
  const ingestionSrc = fs.readFileSync(ingestionPath, 'utf8');
  const stepperSrc = fs.readFileSync(stepperPath, 'utf8');

  await t.test('1. Default Landing View Pivot & Independent Tab Coexistence', () => {
    // Initial tab state must default to 'graph'
    assert.match(
      dualPaneSrc,
      /const\s+\[activeTab,\s*setActiveTab\]\s*=\s*useState<ActiveTab>\('graph'\)/,
      'activeTab must initialize to "graph"'
    );

    // Verify all 5 tabs exist in exact required order inside the tablist
    const tabOrder = ['id="tab-graph"', 'id="tab-qa"', 'id="tab-concepts"', 'id="tab-summary"', 'id="tab-flashcards"'];
    let lastIdx = -1;
    for (const tabId of tabOrder) {
      const idx = dualPaneSrc.indexOf(tabId);
      assert.ok(idx > lastIdx, `Expected ${tabId} to appear in order after index ${lastIdx} (found at ${idx})`);
      lastIdx = idx;
    }

    // Separate tab panels for Graph and Ask KG
    assert.match(dualPaneSrc, /id="tabpanel-graph"\s+role="tabpanel"\s+aria-labelledby="tab-graph"/);
    assert.match(dualPaneSrc, /id="tabpanel-qa"\s+role="tabpanel"\s+aria-labelledby="tab-qa"/);
    assert.match(dualPaneSrc, /<KnowledgeGraphExplorer/);
    assert.match(dualPaneSrc, /<KnowledgeGraphQA/);
  });

  await t.test('2. Study Deck Mode Toggle Accessibility (WCAG 2.1 AA) & Touch Hardening', () => {
    assert.match(
      dualPaneSrc,
      /const\s+\[showFlashcards,\s*setShowFlashcards\]\s*=\s*useState<boolean>\(false\)/,
      'showFlashcards must default to false (OFF)'
    );

    assert.match(dualPaneSrc, /id="study-deck-mode-toggle"/, 'Toggle must have id="study-deck-mode-toggle"');
    assert.match(dualPaneSrc, /role="switch"/, 'Toggle must have role="switch"');
    assert.match(dualPaneSrc, /aria-checked=\{showFlashcards\}/, 'Toggle must bind aria-checked={showFlashcards}');
    assert.match(dualPaneSrc, /aria-label="Toggle Study Deck Mode"/, 'Toggle must include aria-label="Toggle Study Deck Mode"');
    assert.match(dualPaneSrc, /focus:outline-none\s+focus:ring-2/, 'Toggle must provide keyboard focus ring');
    assert.match(dualPaneSrc, /<span className="pointer-events-none select-none">Study Deck Mode<\/span>/, 'Toggle label must be touch-hardened with pointer-events-none');
  });

  await t.test('3. LocalStorage Resilience, Conditional Rendering & Auto-Navigation Fallback', () => {
    // Defensive try/catch around localStorage access (SSR & privacy mode safety)
    assert.match(
      dualPaneSrc,
      /try\s*\{\s*const savedShowFlashcards = localStorage\.getItem\('smartbrief_show_flashcards'\)/,
      'Reading localStorage must be wrapped in try/catch'
    );
    assert.match(
      dualPaneSrc,
      /try\s*\{\s*localStorage\.setItem\('smartbrief_show_flashcards',\s*String\(next\)\)/,
      'Writing localStorage must be wrapped in try/catch'
    );

    // Conditional rendering of Flashcards tab, tabpanel, and concept card deep-link
    assert.match(dualPaneSrc, /\{showFlashcards\s*&&\s*\(\s*<button[\s\S]*?id="tab-flashcards"/);
    assert.match(dualPaneSrc, /\{showFlashcards\s*&&\s*activeTab\s*===\s*'flashcards'\s*&&/);
    assert.match(dualPaneSrc, /\{showFlashcards\s*&&\s*matchingFlashcardIdx\s*!==\s*-1\s*&&/);

    // Dual-layer auto-fallback to 'graph' when toggled OFF while on 'flashcards'
    assert.match(dualPaneSrc, /if\s*\(!showFlashcards\s*&&\s*activeTab\s*===\s*'flashcards'\)\s*\{\s*setActiveTab\('graph'\)/);
    assert.match(dualPaneSrc, /if\s*\(!next\s*&&\s*activeTab\s*===\s*'flashcards'\)\s*\{\s*setActiveTab\('graph'\)/);
  });

  await t.test('4. Header Intelligence Metrics & Empty Graph Defensive Fallbacks', () => {
    // Intelligence metrics bar when Study Deck Mode is OFF
    assert.match(dualPaneSrc, /aria-label="Knowledge Graph intelligence status"/);
    assert.match(dualPaneSrc, /<span>\{concepts\.length\}\s*Entities<\/span>/);
    assert.match(dualPaneSrc, /<span>\{tripletCount\}\s*Triples<\/span>/);
    assert.match(dualPaneSrc, /<span>100% PROV-O Grounded<\/span>/);

    // Active Recall header status when Study Deck Mode is ON
    assert.match(dualPaneSrc, /Active Recall Study Deck Enabled \(\{flashcards\.length\} Cards\)/);

    // Defensive 0-entity / empty-graph handling
    assert.match(
      dualPaneSrc,
      /const tripletCount = result\.graph\?\.triplet_count \|\| result\.graph\?\.triplets\?\.length \|\| \(concepts\.length > 0 \? concepts\.length \* 2 : 0\)/,
      'tripletCount must safely default to 0 when graph and concepts are empty'
    );
    assert.match(
      explorerSrc,
      /nodes\.length === 0[\s\S]*?No knowledge graph nodes available\./,
      'KnowledgeGraphExplorer must render an empty-state fallback when nodes.length === 0'
    );
  });

  await t.test('5. Ingestion & Progress Stepper Copy Alignment', () => {
    assert.match(ingestionSrc, /Analyze & Build Knowledge Graph/);
    assert.match(stepperSrc, /Constructing Knowledge Graph, Subgraph Grounding & Provenance Lineage\.\.\./);
    assert.match(stepperSrc, /Constructing knowledge graph subgraphs, grounding semantic synthesis, and generating study deck items/);
  });

  await t.test('6. Live Docker Container E2E Verification', async () => {
    const frontendBase = process.env.TEST_FRONTEND_URL || 'http://localhost:3003';
    const backendBase = process.env.TEST_BACKEND_URL || 'http://localhost:8003';

    // 6.1 Verify Frontend SSR HTML contains updated CTA copy
    const pageRes = await fetch(frontendBase);
    assert.equal(pageRes.status, 200, 'Frontend root page must return HTTP 200');
    const pageHtml = await pageRes.text();
    assert.match(pageHtml, /Analyze &amp; Build Knowledge Graph/, 'Live frontend HTML must include updated ingestion CTA');

    // 6.2 Verify Backend Health
    const healthRes = await fetch(`${backendBase}/api/health`);
    assert.equal(healthRes.status, 200, 'Backend health endpoint must return HTTP 200');
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'healthy');
    assert.equal(healthData.oxigraph_store_active, true);

    // 6.3 Verify End-to-End Ingestion Pipeline returns Graph-ready payload
    const procRes = await fetch(`${frontendBase}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Neuro-symbolic AI integrates neural networks with Oxigraph RDF knowledge graphs and W3C PROV-O cryptographic provenance to guarantee verifiable reasoning.',
      }),
    });
    assert.equal(procRes.status, 200, 'POST /api/process must return HTTP 200');
    const procData = await procRes.json();
    assert.ok(procData.graph, 'Response must include graph object for default Knowledge Graph landing tab');
    assert.ok(Array.isArray(procData.graph.nodes), 'graph.nodes must be an array');
    assert.ok(Array.isArray(procData.graph.triplets), 'graph.triplets must be an array');
    assert.ok(Array.isArray(procData.flashcards), 'flashcards must still be synthesized for on-demand Study Deck Mode');
  });
});
