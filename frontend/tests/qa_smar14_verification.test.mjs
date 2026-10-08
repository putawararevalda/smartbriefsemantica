import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('QA & DevOps Comprehensive Verification: SMAR-14 GraphRAG Q&A Interface & Evidence Drawer', async (t) => {
  const dualPanePath = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  const qaPath = path.join(frontendDir, 'src/components/KnowledgeGraphQA.tsx');
  const drawerPath = path.join(frontendDir, 'src/components/SubgraphEvidenceDrawer.tsx');
  const routePath = path.join(frontendDir, 'src/app/api/rag/query/route.ts');
  const typesPath = path.join(frontendDir, 'src/types/index.ts');

  assert.ok(fs.existsSync(dualPanePath), 'DualPaneWorkspace.tsx must exist');
  assert.ok(fs.existsSync(qaPath), 'KnowledgeGraphQA.tsx must exist');
  assert.ok(fs.existsSync(drawerPath), 'SubgraphEvidenceDrawer.tsx must exist');
  assert.ok(fs.existsSync(routePath), 'route.ts must exist');
  assert.ok(fs.existsSync(typesPath), 'types/index.ts must exist');

  const dualPaneSrc = fs.readFileSync(dualPanePath, 'utf8');
  const qaSrc = fs.readFileSync(qaPath, 'utf8');
  const drawerSrc = fs.readFileSync(drawerPath, 'utf8');
  const routeSrc = fs.readFileSync(routePath, 'utf8');
  const typesSrc = fs.readFileSync(typesPath, 'utf8');

  await t.test('1. DualPaneWorkspace Integration & Touch Hardening on Ask KG Tab', () => {
    // Tab accessibility & styling
    assert.match(dualPaneSrc, /id="tab-qa"/, 'Must define id="tab-qa"');
    assert.match(dualPaneSrc, /role="tab"/, 'Must define role="tab"');
    assert.match(dualPaneSrc, /aria-controls="tabpanel-qa"/, 'Must control tabpanel-qa');
    assert.match(dualPaneSrc, /aria-selected=\{activeTab === 'qa'\}/, 'Must reflect activeTab === "qa"');

    // Touch event hardening on tab children
    assert.match(dualPaneSrc, /<Sparkles[^>]*pointer-events-none[^>]*\/>/, 'Sparkles icon must have pointer-events-none');
    assert.match(dualPaneSrc, /<span className="pointer-events-none select-none">Ask KG<\/span>/,
      'Ask KG text must have pointer-events-none and select-none');

    // Dedicated badge click handler and keyboard accessibility
    assert.match(dualPaneSrc, /handleBadgeClick\('qa',\s*e\)/, 'RAG badge must use handleBadgeClick');
    assert.match(dualPaneSrc, />\s*RAG\s*<\/span>/, 'Ask KG tab must render dedicated RAG badge');

    // Tab panel rendering
    assert.match(dualPaneSrc, /id="tabpanel-qa"\s+role="tabpanel"\s+aria-labelledby="tab-qa"/,
      'Must render tabpanel-qa with proper ARIA attributes');
    assert.match(dualPaneSrc, /<KnowledgeGraphQA/, 'Must mount KnowledgeGraphQA inside tabpanel-qa');

    // Concept card deep link
    assert.match(dualPaneSrc, /Ask Knowledge Graph about/, 'Concept cards must provide deep link to Ask KG');
  });

  await t.test('2. KnowledgeGraphQA Architecture & User Experience Verification', () => {
    // Dynamic suggestion chips
    assert.match(qaSrc, /suggestionChips = useMemo/, 'Must compute suggestionChips dynamically');
    assert.match(qaSrc, /How does \$\{conceptNames\[0\]\} relate to \$\{conceptNames\[1\]\}\?/,
      'Must synthesize relationship prompt for top concepts');

    // Loading state & animated skeleton
    assert.match(qaSrc, /isLoading/, 'Must manage isLoading state');
    assert.match(qaSrc, /Traversing Oxigraph Subgraph &amp; Grounding Answer\.\.\./,
      'Must display informative skeleton loading state');
    assert.match(qaSrc, /animate-pulse/, 'Loading skeleton must use animated pulse effect');

    // Evidence badge under assistant messages
    assert.match(qaSrc, /Graph Evidence: \{tripleCount\} Triples Used/,
      'Must render graph evidence badge with triple count');
    assert.match(qaSrc, /handleOpenEvidence/, 'Must open evidence drawer on click');

    // Session expiration handling
    assert.match(qaSrc, /errorToast/, 'Must maintain error toast state');
    assert.match(qaSrc, /SESSION_EXPIRED/, 'Must detect SESSION_EXPIRED error code');
    assert.match(qaSrc, /Knowledge graph session expired/i, 'Must display friendly expiration notice');

    // Chat reset
    assert.match(qaSrc, /handleClearChat/, 'Must provide clear chat action');
  });

  await t.test('3. SubgraphEvidenceDrawer Accessibility & PROV-O Lineage Verification', () => {
    // WCAG 2.1 AA dialog attributes
    assert.match(drawerSrc, /role="dialog"/, 'Must specify role="dialog"');
    assert.match(drawerSrc, /aria-modal="true"/, 'Must specify aria-modal="true"');
    assert.match(drawerSrc, /aria-labelledby="drawer-title"/, 'Must link to drawer-title heading');
    assert.match(drawerSrc, /e\.key === 'Escape'/, 'Must close dialog on Escape key');

    // Body scroll lock
    assert.match(drawerSrc, /document\.body\.style\.overflow = 'hidden'/, 'Must lock body scroll while open');

    // Visual Triples Flow
    assert.match(drawerSrc, /-\[\{formattedPredicate\}\]-&gt;/, 'Must format triple flow: (Subject) -[Predicate]-> (Object)');
    assert.match(drawerSrc, /handleCopyAllTriples/, 'Must support bulk triple copy');
    assert.match(drawerSrc, /handleCopySingleTriple/, 'Must support individual triple copy');
    assert.match(drawerSrc, /showRawTriples/, 'Must support raw Turtle syntax toggle');

    // W3C PROV-O audit trail
    assert.match(drawerSrc, /W3C PROV-O Audit Lineage/, 'Must present W3C PROV-O audit header');
    assert.match(drawerSrc, /handleCopyChecksum/, 'Must provide copy action for SHA-256 checksum');
    assert.match(drawerSrc, /wasGeneratedBy/, 'Must display wasGeneratedBy activity');
    assert.match(drawerSrc, /wasAttributedTo/, 'Must display wasAttributedTo agent');
    assert.match(drawerSrc, /wasDerivedFrom/, 'Must display wasDerivedFrom source entities');
  });

  await t.test('4. API Proxy Route Contracts & Fallback Resilience', () => {
    // Input validation
    assert.match(routeSrc, /MISSING_SESSION_ID/, 'Must return MISSING_SESSION_ID when session_id is absent');
    assert.match(routeSrc, /EMPTY_QUERY/, 'Must return EMPTY_QUERY when query is empty');
    assert.match(routeSrc, /status:\s*400/, 'Validation failures must return HTTP status 400');

    // Timeout safety with AbortController
    assert.match(routeSrc, /AbortController/, 'Must implement AbortController timeout protection');

    // Fallback generator
    assert.match(routeSrc, /generateFallbackRAGResponse/, 'Must implement deterministic fallback generator');
    assert.match(routeSrc, /createHash\('sha256'\)/, 'Fallback must compute SHA-256 checksum');
    assert.match(routeSrc, /standard:w3c-prov-o/, 'Fallback must ground in W3C PROV-O ontology');
  });

  await t.test('5. Live Docker Container End-to-End Contract Validation', async () => {
    const frontendBase = process.env.TEST_FRONTEND_URL || 'http://localhost:3003';
    const backendBase = process.env.TEST_BACKEND_URL || 'http://localhost:8003';

    // 5.1 Backend Healthcheck
    const healthRes = await fetch(`${backendBase}/api/health`);
    assert.equal(healthRes.status, 200, 'Backend healthcheck must return 200');
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'healthy');
    assert.equal(healthData.oxigraph_store_active, true);

    // 5.2 Validate Missing Session Validation on Next.js Route
    const invalidRes1 = await fetch(`${frontendBase}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'What is Oxigraph?' }),
    });
    assert.equal(invalidRes1.status, 400);
    const errData1 = await invalidRes1.json();
    assert.equal(errData1.code, 'MISSING_SESSION_ID');

    // 5.3 Validate Empty Query Validation on Next.js Route
    const invalidRes2 = await fetch(`${frontendBase}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 'test_session', query: '   ' }),
    });
    assert.equal(invalidRes2.status, 400);
    const errData2 = await invalidRes2.json();
    assert.equal(errData2.code, 'EMPTY_QUERY');

    // 5.4 Seed an article to get an active Oxigraph session
    const processRes = await fetch(`${backendBase}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Oxigraph powers knowledge graph reasoning. It implements W3C SPARQL standards with high performance in-memory graph traversal. W3C PROV-O tracks provenance.',
      }),
    });
    assert.equal(processRes.status, 200);
    const processData = await processRes.json();
    const activeSessionId = processData.provenance_summary?.session_id || 'proc_qa_e2e_session';

    // 5.5 Query live Next.js route with active session
    const queryRes = await fetch(`${frontendBase}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: activeSessionId,
        query: 'How does Oxigraph power knowledge graphs?',
        top_k_triples: 8,
      }),
    });
    assert.equal(queryRes.status, 200, 'Query endpoint must return 200 OK');
    const queryData = await queryRes.json();

    assert.ok(queryData.query, 'Must return query in response');
    assert.ok(queryData.answer, 'Must return synthesized answer');
    assert.ok(queryData.graph_context, 'Must return graph_context');
    assert.ok(Array.isArray(queryData.graph_context.retrieved_triples), 'retrieved_triples must be an array');
    assert.ok(queryData.graph_context.retrieved_triples.length > 0, 'Must retrieve triples from graph');
    assert.ok(queryData.provenance, 'Must return provenance object');
    assert.ok(queryData.provenance.checksum, 'Must contain provenance checksum');
    assert.ok(queryData.provenance.w3c_prov, 'Must contain w3c_prov metadata');
  });
});
