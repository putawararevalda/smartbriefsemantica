import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('SMAR-22: Animated Traversal Hop Stepper for GraphRAG Q&A Verification', async (t) => {
  const qaFile = path.join(frontendDir, 'src/components/KnowledgeGraphQA.tsx');
  const cssFile = path.join(frontendDir, 'src/app/globals.css');

  assert.ok(fs.existsSync(qaFile), 'KnowledgeGraphQA.tsx must exist');
  assert.ok(fs.existsSync(cssFile), 'globals.css must exist');

  const qaSrc = fs.readFileSync(qaFile, 'utf8');
  const cssSrc = fs.readFileSync(cssFile, 'utf8');

  await t.test('1. Loading Traversal Animation & Multi-step Progress Pipeline', () => {
    // Preserves legacy header for backward compatibility
    assert.match(
      qaSrc,
      /Traversing Oxigraph Subgraph &amp; Grounding Answer\.\.\./,
      'Loading indicator must preserve Oxigraph traversal headline'
    );
    assert.match(qaSrc, /animate-pulse/, 'Loading state must include animate-pulse');

    // Progress pipeline container with role="status"
    assert.match(
      qaSrc,
      /role="status"/,
      'Loading traversal pipeline must declare role="status" for accessibility'
    );
    assert.match(
      qaSrc,
      /aria-label=".*traversal.*in progress"/i,
      'Loading pipeline must specify accessible aria-label'
    );

    // Step 1: Entity Grounding
    assert.match(qaSrc, /Entity Grounding/, 'Loading state must render Step 1: Entity Grounding');
    assert.match(
      qaSrc,
      /Matching concept anchors/,
      'Loading state must describe Entity Grounding (Matching concept anchors)'
    );

    // Step 2: Graph Traversal
    assert.match(qaSrc, /Graph Traversal/, 'Loading state must render Step 2: Graph Traversal');
    assert.match(
      qaSrc,
      /1-Hop &amp; 2-Hop SPARQL expansion/,
      'Loading state must describe Graph Traversal (1-Hop & 2-Hop SPARQL expansion)'
    );

    // Step 3: Answer Synthesis
    assert.match(qaSrc, /Answer Synthesis/, 'Loading state must render Step 3: Answer Synthesis');
    assert.match(
      qaSrc,
      /Semantica context generation/,
      'Loading state must describe Answer Synthesis (Semantica context generation)'
    );

    // Active pipeline step cycling state
    assert.match(qaSrc, /loadingStep/, 'Component must maintain active loadingStep state');
    assert.match(
      qaSrc,
      /setInterval\(\(\)\s*=>\s*\{[\s\S]*?setLoadingStep/,
      'Component must smoothly cycle active loadingStep during query execution'
    );
  });

  await t.test('2. Completed Hop Stepper Breadcrumb on Assistant Message', () => {
    // Conditioned on graph_context
    assert.match(
      qaSrc,
      /!isUser && msg\.graph_context/,
      'Traversal Hop Stepper must only render on assistant messages with graph_context'
    );

    // Stepper heading / region
    assert.match(
      qaSrc,
      /Traversal Hop Stepper/,
      'Must render Traversal Hop Stepper label'
    );

    // Node 1: Matched concept anchor label and badge
    assert.match(
      qaSrc,
      /firstConceptLabel/,
      'Hop Stepper must display first matched concept anchor label'
    );
    assert.match(
      qaSrc,
      /🌱/,
      'Hop Stepper Node 1 must display concept anchor icon'
    );

    // Connector 1: 1-Hop
    assert.match(
      qaSrc,
      /1-Hop/,
      'Hop Stepper must display 1-Hop traversal connector'
    );

    // Node 2: Traversed Triples
    assert.match(
      qaSrc,
      /\{tripleCount\}\s*Triples/,
      'Hop Stepper Node 2 must display traversed triples count'
    );
    assert.match(
      qaSrc,
      /🔗/,
      'Hop Stepper Node 2 must display triples icon'
    );

    // Connector 2: Traversal Hops count
    assert.match(
      qaSrc,
      /\{traversalHops\}-Hop/,
      'Hop Stepper Connector 2 must display dynamic traversal_hops count'
    );

    // Node 3: Evidence Subgraph
    assert.match(
      qaSrc,
      /Evidence Subgraph/,
      'Hop Stepper Node 3 must display Evidence Subgraph'
    );
    assert.match(
      qaSrc,
      /🎯/,
      'Hop Stepper Node 3 must display Evidence Subgraph icon'
    );

    // Staggered entrance animation
    assert.match(
      qaSrc,
      /animate-in fade-in slide-in-from-left duration-300/,
      'Nodes must apply staggered Tailwind entrance animation classes'
    );
    assert.match(qaSrc, /delay-150/, 'Must stagger Node 2 entrance by ~150ms');
    assert.match(qaSrc, /delay-300/, 'Must stagger Node 3 entrance by ~300ms');
  });

  await t.test('3. Subgraph Evidence Drawer Integration on Click', () => {
    // Clicking nodes or badges invokes handleOpenEvidence(msg)
    const matches = qaSrc.match(/onClick=\{\(\) => handleOpenEvidence\(msg\)\}/g) || [];
    assert.ok(
      matches.length >= 4,
      `Expected at least 4 handleOpenEvidence click handlers for nodes and badges, found ${matches.length}`
    );
  });

  await t.test('4. Accessibility & Motion Reduction Compliance', () => {
    // Honors prefers-reduced-motion
    assert.match(
      qaSrc,
      /motion-reduce:animate-none/,
      'KnowledgeGraphQA must configure motion-reduce:animate-none for reduced motion users'
    );
    assert.match(
      qaSrc,
      /motion-reduce:transition-none/,
      'KnowledgeGraphQA must configure motion-reduce:transition-none for reduced motion users'
    );

    // Theme adherence: Indigo/Slate
    assert.match(
      qaSrc,
      /bg-indigo-50\/80/,
      'Hop Stepper must blend with bg-indigo-50/80 theme styling'
    );
    assert.match(
      qaSrc,
      /border-indigo-200/,
      'Hop Stepper must blend with border-indigo-200 theme styling'
    );
    assert.match(
      qaSrc,
      /text-indigo-900/,
      'Hop Stepper must blend with text-indigo-900 theme styling'
    );

    // CSS Keyframes and animation utilities
    assert.match(cssSrc, /@keyframes slideInFromLeft/, 'globals.css must define slideInFromLeft keyframe');
    assert.match(cssSrc, /@keyframes fadeIn/, 'globals.css must define fadeIn keyframe');
    assert.match(cssSrc, /\.animate-in/, 'globals.css must define .animate-in utility');
  });

  await t.test('5. Non-Regression: Existing Graph Evidence Badge, Chips, and Handlers', () => {
    assert.match(
      qaSrc,
      /Graph Evidence:\s*\{tripleCount\}\s*Triples Used/,
      'Assistant answers must retain original Graph Evidence: X Triples Used badge'
    );
    assert.match(qaSrc, /suggestionChips/, 'Suggestion chips must be preserved');
    assert.match(qaSrc, /handleClearChat/, 'handleClearChat must be preserved');
    assert.match(qaSrc, /errorToast/, 'errorToast must be preserved');
    assert.match(qaSrc, /<SubgraphEvidenceDrawer/, 'SubgraphEvidenceDrawer must be preserved');
  });
});
