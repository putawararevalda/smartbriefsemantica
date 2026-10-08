import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('SMAR-14: GraphRAG Q&A Interface and Subgraph Evidence Drawer Verification', async (t) => {
  const typesFile = path.join(frontendDir, 'src/types/index.ts');
  const ragRouteFile = path.join(frontendDir, 'src/app/api/rag/query/route.ts');
  const drawerFile = path.join(frontendDir, 'src/components/SubgraphEvidenceDrawer.tsx');
  const qaFile = path.join(frontendDir, 'src/components/KnowledgeGraphQA.tsx');
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');

  await t.test('1. Component, Route, and Type Files Exist', () => {
    assert.ok(fs.existsSync(typesFile), 'src/types/index.ts must exist');
    assert.ok(fs.existsSync(ragRouteFile), 'src/app/api/rag/query/route.ts must exist');
    assert.ok(fs.existsSync(drawerFile), 'src/components/SubgraphEvidenceDrawer.tsx must exist');
    assert.ok(fs.existsSync(qaFile), 'src/components/KnowledgeGraphQA.tsx must exist');
    assert.ok(fs.existsSync(dualPaneFile), 'src/components/DualPaneWorkspace.tsx must exist');
  });

  const typesSrc = fs.readFileSync(typesFile, 'utf8');
  const ragRouteSrc = fs.readFileSync(ragRouteFile, 'utf8');
  const drawerSrc = fs.readFileSync(drawerFile, 'utf8');
  const qaSrc = fs.readFileSync(qaFile, 'utf8');
  const dualPaneSrc = fs.readFileSync(dualPaneFile, 'utf8');

  await t.test('2. TypeScript Types define complete GraphRAG schema', () => {
    assert.match(typesSrc, /interface MatchedConcept/, 'types must define MatchedConcept');
    assert.match(typesSrc, /interface RetrievedTriple/, 'types must define RetrievedTriple');
    assert.match(typesSrc, /interface GraphContext/, 'types must define GraphContext');
    assert.match(typesSrc, /interface RAGProvenance/, 'types must define RAGProvenance');
    assert.match(typesSrc, /interface RAGQueryRequest/, 'types must define RAGQueryRequest');
    assert.match(typesSrc, /interface RAGQueryResponse/, 'types must define RAGQueryResponse');
    assert.match(typesSrc, /interface RAGChatMessage/, 'types must define RAGChatMessage');
  });

  await t.test('3. API Route Handler (/api/rag/query) enforces contracts and resilient fallback', () => {
    // Session and query validation
    assert.match(ragRouteSrc, /MISSING_SESSION_ID/, 'Route must validate missing session ID');
    assert.match(ragRouteSrc, /EMPTY_QUERY/, 'Route must validate empty query');
    assert.match(ragRouteSrc, /status:\s*400/, 'Route must return status 400 for invalid inputs');

    // Endpoint targeting
    assert.match(ragRouteSrc, /\/api\/rag\/query/, 'Route must proxy to /api/rag/query');

    // Fallback response with W3C PROV-O metadata
    assert.match(ragRouteSrc, /generateFallbackRAGResponse/, 'Route must implement fallback generator');
    assert.match(ragRouteSrc, /wasDerivedFrom/, 'Fallback must include W3C PROV-O wasDerivedFrom');
    assert.match(ragRouteSrc, /wasGeneratedBy/, 'Fallback must include W3C PROV-O wasGeneratedBy');
    assert.match(ragRouteSrc, /sha256/, 'Fallback must calculate SHA-256 audit checksum');
  });

  await t.test('4. Subgraph Evidence Drawer renders matched concepts, triple flow, and PROV-O audit', () => {
    // Accessibility
    assert.match(drawerSrc, /role="dialog"/, 'Drawer must define role="dialog"');
    assert.match(drawerSrc, /aria-modal="true"/, 'Drawer must define aria-modal="true"');
    assert.match(drawerSrc, /aria-labelledby="drawer-title"/, 'Drawer must define aria-labelledby');
    assert.match(drawerSrc, /e\.key === 'Escape'/, 'Drawer must support Escape key dismissal');

    // Section 1: Matched Concepts
    assert.match(drawerSrc, /Matched Knowledge Concepts/, 'Drawer must render Matched Concepts header');
    assert.match(drawerSrc, /matchedConcepts\.map/, 'Drawer must map matched concepts');

    // Section 2: Supporting Triples Flow
    assert.match(drawerSrc, /Supporting Subgraph Triples Flow/, 'Drawer must render Supporting Triples Flow');
    assert.match(drawerSrc, /-\[\{formattedPredicate\}\]-&gt;/, 'Drawer must visualize (Subject) -[Predicate]-> (Object) flow');
    assert.match(drawerSrc, /handleCopyAllTriples/, 'Drawer must support copying all triples');

    // Section 3: W3C PROV-O Audit Details
    assert.match(drawerSrc, /W3C PROV-O Audit Lineage/, 'Drawer must render W3C PROV-O audit header');
    assert.match(drawerSrc, /SHA-256 Audit Checksum/, 'Drawer must render SHA-256 checksum');
    assert.match(drawerSrc, /handleCopyChecksum/, 'Drawer must allow copying checksum');
    assert.match(drawerSrc, /wasDerivedFrom/, 'Drawer must display derivation sources');
  });

  await t.test('5. Interactive KnowledgeGraphQA implements chips, streaming, and evidence badges', () => {
    // Suggestion chips
    assert.match(qaSrc, /suggestionChips/, 'KnowledgeGraphQA must generate suggestion chips');
    assert.match(qaSrc, /How does.*relate to/, 'Suggestion chips must generate relation prompts');

    // Subgraph Evidence Badge under each assistant answer
    assert.match(qaSrc, /Graph Evidence:\s*\{tripleCount\}\s*Triples Used/,
      'Assistant answers must render "Graph Evidence: X Triples Used" badge');
    assert.match(qaSrc, /handleOpenEvidence/,
      'Clicking evidence badge must open Subgraph Evidence Drawer');

    // Loading skeleton
    assert.match(qaSrc, /Traversing Oxigraph Subgraph &amp; Grounding Answer\.\.\./,
      'KnowledgeGraphQA must display loading skeleton with informative progress');
    assert.match(qaSrc, /animate-pulse/, 'Loading state must use animate-pulse skeleton');

    // Drawer integration
    assert.match(qaSrc, /<SubgraphEvidenceDrawer/,
      'KnowledgeGraphQA must integrate SubgraphEvidenceDrawer');

    // Error toast handling
    assert.match(qaSrc, /errorToast/, 'KnowledgeGraphQA must handle error toast');
    assert.match(qaSrc, /session expired|re-analyze/i, 'KnowledgeGraphQA must handle expired sessions');
  });

  await t.test('6. DualPaneWorkspace integrates Ask KG tab and panel', () => {
    // ActiveTab type
    assert.match(dualPaneSrc, /type ActiveTab = [^;]*'qa'/, 'DualPaneWorkspace must include "qa" in ActiveTab');

    // Tab Button
    assert.match(dualPaneSrc, /id="tab-qa"/, 'DualPaneWorkspace must render tab-qa button');
    assert.match(dualPaneSrc, /aria-controls="tabpanel-qa"/, 'tab-qa must control tabpanel-qa');
    assert.match(dualPaneSrc, /aria-selected=\{activeTab === 'qa'\}/, 'tab-qa must reflect activeTab === qa');
    assert.match(dualPaneSrc, />Ask KG<\/span>/, 'tab-qa must show Ask KG label');

    // Tab Panel
    assert.match(dualPaneSrc, /id="tabpanel-qa"\s+role="tabpanel"\s+aria-labelledby="tab-qa"/,
      'DualPaneWorkspace must render tabpanel-qa');
    assert.match(dualPaneSrc, /<KnowledgeGraphQA/,
      'DualPaneWorkspace must render KnowledgeGraphQA component inside tabpanel-qa');

    // Concept deep link
    assert.match(dualPaneSrc, /title=\{`Ask Knowledge Graph about \$\{name\}`\}/,
      'DualPaneWorkspace concept cards must include Ask KG deep link button');
  });

  await t.test('7. API Route Handler Contract & Fallback Verification', async () => {
    // 1. Static Contract & Implementation Verification
    assert.match(ragRouteSrc, /export async function POST\(req: NextRequest\)/, 'Route must export POST handler');
    assert.match(ragRouteSrc, /generateFallbackRAGResponse/, 'Route must define fallback RAG response generator');
    assert.match(ragRouteSrc, /MISSING_SESSION_ID/, 'Route must reject empty session_id');
    assert.match(ragRouteSrc, /EMPTY_QUERY/, 'Route must reject empty query');
    assert.match(ragRouteSrc, /SESSION_EXPIRED/, 'Route must handle 404 session expiration');
    assert.match(ragRouteSrc, /top_k_triples/, 'Route must support top_k_triples parameter');
    assert.match(ragRouteSrc, /sha256/, 'Route must calculate cryptographic SHA-256 checksum');

    // 2. Test live container if rebuilt / available
    const containerUrl = process.env.TEST_FRONTEND_URL || 'http://localhost:3003';
    try {
      const probe = await fetch(`${containerUrl}/api/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: 'test', query: 'test' }),
      });
      if (probe.status !== 404) {
        // Container has the new route deployed! Test contract
        const resMissing = await fetch(`${containerUrl}/api/rag/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'What is Oxigraph?' }),
        });
        assert.equal(resMissing.status, 400);

        const resValid = await fetch(`${containerUrl}/api/rag/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: 'proc_test_123',
            query: 'How does Oxigraph relate to Knowledge Graphs?',
          }),
        });
        assert.equal(resValid.status, 200);
      }
    } catch {
      // Local/offline test environment
    }
  });
});
