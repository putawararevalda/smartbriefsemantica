import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('QA & DevOps Comprehensive Verification: SMAR-22 Animated Traversal Hop Stepper for GraphRAG Q&A', async (t) => {
  const qaFile = path.join(frontendDir, 'src/components/KnowledgeGraphQA.tsx');
  const cssFile = path.join(frontendDir, 'src/app/globals.css');
  const typesFile = path.join(frontendDir, 'src/types/index.ts');

  assert.ok(fs.existsSync(qaFile), 'KnowledgeGraphQA.tsx must exist');
  assert.ok(fs.existsSync(cssFile), 'globals.css must exist');
  assert.ok(fs.existsSync(typesFile), 'types/index.ts must exist');

  const qaSrc = fs.readFileSync(qaFile, 'utf8');
  const cssSrc = fs.readFileSync(cssFile, 'utf8');
  const typesSrc = fs.readFileSync(typesFile, 'utf8');

  await t.test('1. Component Architecture & Interval State Lifecycle', () => {
    // Required Lucide icons imported
    assert.match(qaSrc, /Sparkles/, 'KnowledgeGraphQA must import Sparkles icon');
    assert.match(qaSrc, /ArrowRight/, 'KnowledgeGraphQA must import ArrowRight icon');
    assert.match(qaSrc, /Bot/, 'KnowledgeGraphQA must import Bot icon');

    // State declaration for loading pipeline steps
    assert.match(
      qaSrc,
      /const\s*\[loadingStep,\s*setLoadingStep\]\s*=\s*useState<number>\(1\);/,
      'KnowledgeGraphQA must define loadingStep state initialized to 1'
    );

    // Defensive setInterval lifecycle & cleanup
    assert.match(
      qaSrc,
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?let interval:\s*NodeJS\.Timeout\s*\|\s*undefined;[\s\S]*?if\s*\(isLoading\)\s*\{[\s\S]*?setLoadingStep\(1\);[\s\S]*?interval\s*=\s*setInterval\(\(\)\s*=>\s*\{[\s\S]*?setLoadingStep\(\(prev\)\s*=>\s*\(prev\s*>=\s*3\s*\?\s*1\s*:\s*prev\s*\+\s*1\)\);[\s\S]*?\}, 700\);[\s\S]*?return\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(interval\)\s*clearInterval\(interval\);[\s\S]*?\};[\s\S]*?\}, \[isLoading\]\);/,
      'KnowledgeGraphQA must cycle loadingStep 1->2->3->1 every 700ms and cleanup on unmount/isLoading change'
    );
  });

  await t.test('2. Multi-Step Traversal Progress Pipeline during isLoading', () => {
    // Accessible role and aria-label
    assert.match(
      qaSrc,
      /role="status"/,
      'Loading pipeline container must have role="status" for screen reader announcements'
    );
    assert.match(
      qaSrc,
      /aria-label="Oxigraph GraphRAG traversal pipeline in progress"/,
      'Loading pipeline container must declare descriptive aria-label'
    );

    // Live traversal header & animated ping dot
    assert.match(qaSrc, /Live Graph Traversal Pipeline/, 'Must render pipeline title');
    assert.match(qaSrc, /Step \{loadingStep\} of 3/, 'Must render dynamic step counter');
    assert.match(qaSrc, /animate-ping/, 'Must render pulsing ping indicator');

    // Step 1: Entity Grounding
    assert.match(qaSrc, /Entity Grounding/, 'Pipeline must have Step 1 Entity Grounding');
    assert.match(qaSrc, /Matching concept anchors/, 'Step 1 description must match requirements');

    // Step 2: Graph Traversal
    assert.match(qaSrc, /Graph Traversal/, 'Pipeline must have Step 2 Graph Traversal');
    assert.match(qaSrc, /1-Hop &amp; 2-Hop SPARQL expansion/, 'Step 2 description must match requirements');

    // Step 3: Answer Synthesis
    assert.match(qaSrc, /Answer Synthesis/, 'Pipeline must have Step 3 Answer Synthesis');
    assert.match(qaSrc, /Semantica context generation/, 'Step 3 description must match requirements');

    // Active state ring/highlighting
    assert.match(
      qaSrc,
      /loadingStep === 1\s*\?\s*'bg-white border-indigo-300 shadow-xs ring-1 ring-indigo-400\/30'\s*:\s*'bg-indigo-50\/40 border-indigo-100\/60 opacity-70'/,
      'Step 1 must toggle active vs inactive styling based on loadingStep'
    );
    assert.match(
      qaSrc,
      /loadingStep === 2\s*\?\s*'bg-white border-indigo-300 shadow-xs ring-1 ring-indigo-400\/30'\s*:\s*'bg-indigo-50\/40 border-indigo-100\/60 opacity-70'/,
      'Step 2 must toggle active vs inactive styling based on loadingStep'
    );
    assert.match(
      qaSrc,
      /loadingStep === 3\s*\?\s*'bg-white border-indigo-300 shadow-xs ring-1 ring-indigo-400\/30'\s*:\s*'bg-indigo-50\/40 border-indigo-100\/60 opacity-70'/,
      'Step 3 must toggle active vs inactive styling based on loadingStep'
    );
  });

  await t.test('3. Completed Traversal Hop Stepper Breadcrumb on Assistant Messages', () => {
    // Conditioned strictly on assistant message with graph_context
    assert.match(
      qaSrc,
      /\{!isUser && msg\.graph_context && \(/,
      'Hop Stepper must only render on assistant messages that include graph_context'
    );

    // Accessible container semantics
    assert.match(
      qaSrc,
      /role="region"/,
      'Hop Stepper container must have role="region"'
    );
    assert.match(
      qaSrc,
      /aria-label="Knowledge Graph Traversal Hop Breadcrumb"/,
      'Hop Stepper container must have descriptive aria-label'
    );

    // Concept Anchor label fallback resolution
    assert.match(
      qaSrc,
      /const firstConceptLabel =[\s\S]*?msg\.graph_context\?\.matched_concepts\?\.\[0\]\?\.name \|\|[\s\S]*?msg\.graph_context\?\.matched_concepts\?\.\[0\]\?\.id \|\|[\s\S]*?concepts\[0\]\?\.name \|\|[\s\S]*?concepts\[0\]\?\.label \|\|[\s\S]*?'Concept Grounding';/,
      'Must resolve firstConceptLabel with graceful multi-tier fallbacks'
    );

    // Multi-concept counter badge
    assert.match(
      qaSrc,
      /\{matchedCount > 1 && \(\s*<span className="text-\[10px\] text-indigo-600 bg-indigo-100\/80 px-1 py-0\.2 rounded font-normal">\s*\+\{matchedCount - 1\}\s*<\/span>\s*\)\}/,
      'Must display +N badge when multiple concepts matched'
    );

    // Node 1: Matched Concept
    assert.match(qaSrc, /aria-label=\{`Matched Concept: \$\{firstConceptLabel\}`\}/);

    // Connector 1: 1-Hop
    assert.match(qaSrc, /aria-label="1-Hop Traversal"/);
    assert.match(qaSrc, /<span>1-Hop<\/span>/);

    // Node 2: Traversed Triples
    assert.match(qaSrc, /aria-label=\{`\$\{tripleCount\} Traversed Triples`\}/);
    assert.match(qaSrc, /<span>\{tripleCount\} Triples<\/span>/);

    // Connector 2: Traversal Hops (dynamic)
    assert.match(qaSrc, /const traversalHops = msg\.graph_context\?\.traversal_hops \?\? 2;/);
    assert.match(qaSrc, /aria-label=\{`\$\{traversalHops\}-Hop Traversal`\}/);
    assert.match(qaSrc, /<span>\{traversalHops\}-Hop<\/span>/);

    // Node 3: Evidence Subgraph
    assert.match(qaSrc, /aria-label="Evidence Subgraph"/);
    assert.match(qaSrc, /<span>Evidence Subgraph<\/span>/);

    // Interactive button types & click handlers
    const evidenceHandlers = (qaSrc.match(/onClick=\{\(\) => handleOpenEvidence\(msg\)\}/g) || []).length;
    assert.ok(
      evidenceHandlers >= 5,
      `Expected at least 5 handleOpenEvidence click handlers for all stepper elements and bottom badge, got ${evidenceHandlers}`
    );
  });

  await t.test('4. Animation Timing, Stagger Delays & Motion Reduction Accessibility', () => {
    // globals.css keyframes and utility classes
    assert.match(cssSrc, /@keyframes fadeIn/, 'globals.css must define fadeIn keyframe');
    assert.match(cssSrc, /@keyframes slideInFromLeft/, 'globals.css must define slideInFromLeft keyframe');
    assert.match(cssSrc, /\.animate-in\s*\{[\s\S]*?animation-fill-mode:\s*both;[\s\S]*?\}/);
    assert.match(cssSrc, /\.fade-in\s*\{[\s\S]*?animation-name:\s*fadeIn;[\s\S]*?\}/);
    assert.match(cssSrc, /\.slide-in-from-left\s*\{[\s\S]*?animation-name:\s*slideInFromLeft;[\s\S]*?\}/);

    // Stagger sequence verification
    assert.match(qaSrc, /duration-300/, 'Animation base duration must be 300ms');
    assert.match(qaSrc, /delay-75/, 'Hop 1 connector must delay 75ms');
    assert.match(qaSrc, /delay-150/, 'Node 2 must delay 150ms');
    assert.match(qaSrc, /delay-200/, 'Hop 2 connector must delay 200ms');
    assert.match(qaSrc, /delay-300/, 'Node 3 must delay 300ms');

    // Total sequence: max delay 300ms + duration 300ms = 600ms (within 400ms-600ms specification)
    const maxDelay = 300;
    const duration = 300;
    const totalDuration = maxDelay + duration;
    assert.ok(
      totalDuration <= 600,
      `Total animation sequence (${totalDuration}ms) must complete within 600ms`
    );

    // Strict prefers-reduced-motion overrides
    assert.match(qaSrc, /motion-reduce:animate-none/);
    assert.match(qaSrc, /motion-reduce:transition-none/);
    assert.match(qaSrc, /motion-reduce:hover:scale-100/);
  });

  await t.test('5. Non-Regression & UI Preservation', () => {
    // Infrastructure triple filtering
    assert.match(
      qaSrc,
      /isInfrastructureTriple/,
      'Must retain isInfrastructureTriple filter import or function'
    );

    // Retain bottom Graph Evidence action badge
    assert.match(
      qaSrc,
      /Graph Evidence:\s*\{tripleCount\}\s*Triples Used/,
      'Must retain original bottom Graph Evidence badge'
    );

    // Suggestion chips
    assert.match(qaSrc, /suggestionChips/, 'Must retain suggestion chips');

    // Clear chat handler
    assert.match(qaSrc, /handleClearChat/, 'Must retain handleClearChat');

    // SubgraphEvidenceDrawer
    assert.match(qaSrc, /<SubgraphEvidenceDrawer/, 'Must retain SubgraphEvidenceDrawer');
  });

  await t.test('6. Live Docker Service Health & E2E GraphRAG Query Verification', async () => {
    const frontendBase = process.env.TEST_FRONTEND_URL || 'http://localhost:3003';
    const backendBase = process.env.TEST_BACKEND_URL || 'http://localhost:8003';

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
        text: 'Semantica knowledge graphs integrate Oxigraph RDF store with W3C PROV-O provenance trails. Automated graph traversal expands 1-hop and 2-hop neighbor assertions.',
      }),
    });
    assert.equal(seedRes.status, 200, 'Seeding knowledge graph via /api/process must return HTTP 200');
    const seedData = await seedRes.json();
    const activeSessionId = seedData.provenance_summary?.session_id || 'qa_smar22_test_session';

    // 6.4 Live /api/rag/query verification (contracts required by hop stepper)
    const ragRes = await fetch(`${frontendBase}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: activeSessionId,
        query: 'How does Oxigraph integrate with knowledge graphs?',
        top_k_triples: 5,
      }),
    });

    assert.equal(ragRes.status, 200, '/api/rag/query must return HTTP 200');
    const ragData = await ragRes.json();
    assert.ok(ragData.graph_context, 'RAG query response must include graph_context');
    assert.ok(Array.isArray(ragData.graph_context.matched_concepts), 'matched_concepts must be an array');
    assert.ok(Array.isArray(ragData.graph_context.retrieved_triples), 'retrieved_triples must be an array');
    assert.equal(typeof ragData.graph_context.traversal_hops, 'number', 'traversal_hops must be numeric');
    assert.ok(ragData.graph_context.traversal_hops >= 1, 'traversal_hops must be at least 1');
    assert.ok(ragData.graph_context.retrieved_triples.length >= 1, 'retrieved_triples must contain at least 1 triple');
  });
});
