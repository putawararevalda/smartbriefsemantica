import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendDir, '..');

test('QA & DevOps Comprehensive Verification: SMAR-19 Infrastructure Triple Filtering & Session Isolation', async (t) => {
  const backendMainPath = path.join(repoRoot, 'backend/main.py');
  const drawerPath = path.join(frontendDir, 'src/components/SubgraphEvidenceDrawer.tsx');
  const explorerPath = path.join(frontendDir, 'src/components/KnowledgeGraphExplorer.tsx');
  const qaPath = path.join(frontendDir, 'src/components/KnowledgeGraphQA.tsx');

  assert.ok(fs.existsSync(backendMainPath), 'backend/main.py must exist');
  assert.ok(fs.existsSync(drawerPath), 'SubgraphEvidenceDrawer.tsx must exist');
  assert.ok(fs.existsSync(explorerPath), 'KnowledgeGraphExplorer.tsx must exist');
  assert.ok(fs.existsSync(qaPath), 'KnowledgeGraphQA.tsx must exist');

  const backendSrc = fs.readFileSync(backendMainPath, 'utf8');
  const drawerSrc = fs.readFileSync(drawerPath, 'utf8');
  const explorerSrc = fs.readFileSync(explorerPath, 'utf8');
  const qaSrc = fs.readFileSync(qaPath, 'utf8');

  await t.test('1. Backend Centralized _is_infrastructure_triple Helper & SPARQL Traversal Guard', () => {
    assert.match(
      backendSrc,
      /def _is_infrastructure_triple\(subject:\s*str,\s*predicate:\s*str,\s*obj:\s*str\)\s*->\s*bool:/,
      'backend/main.py must define centralized _is_infrastructure_triple(subject, predicate, obj)'
    );
    assert.match(
      backendSrc,
      /\?p\s*!=\s*<https:\/\/smartbrief\.ai\/ontology\/extractedFrom>/,
      '_traverse_subgraph SPARQL filter must exclude extractedFrom predicate'
    );
    assert.match(
      backendSrc,
      /!STRSTARTS\(STR\(\?s\),\s*"urn:smartbrief:doc:"\)/,
      '_traverse_subgraph SPARQL filter must exclude urn:smartbrief:doc: subjects'
    );
    assert.match(
      backendSrc,
      /!STRSTARTS\(STR\(\?o\),\s*"urn:smartbrief:doc:"\)/,
      '_traverse_subgraph SPARQL filter must exclude urn:smartbrief:doc: objects'
    );
    assert.match(
      backendSrc,
      /EXISTS\s*\{\{\s*\?s\s*<https:\/\/smartbrief\.ai\/ontology\/extractedFrom>\s*<\{doc_uri\}>\s*\}\}/,
      '_traverse_subgraph must preserve EXISTS extractedFrom check for strict cross-session isolation'
    );
  });

  await t.test('2. Defensive Frontend Filtering in SubgraphEvidenceDrawer, KnowledgeGraphExplorer & KnowledgeGraphQA', () => {
    assert.match(drawerSrc, /export function isInfrastructureTriple/, 'SubgraphEvidenceDrawer must export isInfrastructureTriple');
    assert.match(drawerSrc, /raw\.includes\('extractedFrom'\)/, 'SubgraphEvidenceDrawer must inspect raw_triple for extractedFrom');
    assert.match(drawerSrc, /raw\.includes\('urn:smartbrief:doc:'\)/, 'SubgraphEvidenceDrawer must inspect raw_triple for urn:smartbrief:doc:');
    assert.match(explorerSrc, /export function isInfrastructureTriple/, 'KnowledgeGraphExplorer must export isInfrastructureTriple');
    assert.match(qaSrc, /isInfrastructureTriple/, 'KnowledgeGraphQA must filter retrieved_triples badge count with isInfrastructureTriple');
  });

  await t.test('3. Live Docker E2E Verification: Zero Bookkeeping Leakage & Cross-Session Isolation', async () => {
    const frontendBase = process.env.TEST_FRONTEND_URL || 'http://localhost:3003';
    const backendBase = process.env.TEST_BACKEND_URL || 'http://localhost:8003';

    // 3.1 Verify Backend Health
    const healthRes = await fetch(`${backendBase}/api/health`);
    assert.equal(healthRes.status, 200, 'Backend health check must return HTTP 200');

    // 3.2 Process Session A (Environmental Economics)
    const sessionA = 'proc_qa_smar19_env';
    const envText =
      'Environmental economics examines market externalities and planetary boundaries. ' +
      'Carbon pricing mechanisms such as cap-and-trade allowances internalize greenhouse gas emissions costs ' +
      'while circular economy frameworks promote closed-loop material recovery.';

    const procARes = await fetch(`${backendBase}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: envText, session_id: sessionA }),
    });
    assert.equal(procARes.status, 200, 'POST /api/process (Session A) must return HTTP 200');
    const procAData = await procARes.json();

    const tripletsA = procAData.graph?.triplets || [];
    assert.ok(tripletsA.length > 0, 'Session A must produce domain triplets');
    for (const t of tripletsA) {
      assert.ok(!t.predicate.includes('extractedFrom'), `Leaked extractedFrom in graph.triplets: ${JSON.stringify(t)}`);
      assert.ok(!t.subject.startsWith('urn:smartbrief:doc:'), `Leaked doc URN in subject: ${JSON.stringify(t)}`);
      assert.ok(!t.object.startsWith('urn:smartbrief:doc:'), `Leaked doc URN in object: ${JSON.stringify(t)}`);
      assert.ok(!t.object.endsWith('/Document'), `Leaked Document type in object: ${JSON.stringify(t)}`);
    }

    for (const b of procAData.graph?.sparql_sample || []) {
      const sVal = b.s?.value || '';
      const pVal = b.p?.value || '';
      const oVal = b.o?.value || '';
      assert.ok(!pVal.includes('extractedFrom'), `Leaked extractedFrom in sparql_sample: ${JSON.stringify(b)}`);
      assert.ok(!sVal.startsWith('urn:smartbrief:doc:'), `Leaked doc URN in sparql_sample s: ${JSON.stringify(b)}`);
      assert.ok(!oVal.startsWith('urn:smartbrief:doc:'), `Leaked doc URN in sparql_sample o: ${JSON.stringify(b)}`);
    }

    // 3.3 Process Session B (Quantum Computing) to verify cross-session isolation
    const sessionB = 'proc_qa_smar19_quantum';
    const quantumText =
      'Superconducting transmon qubits leverage Josephson junctions and topological surface code error correction ' +
      'to mitigate quantum decoherence in fault-tolerant quantum processors.';

    const procBRes = await fetch(`${backendBase}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: quantumText, session_id: sessionB }),
    });
    assert.equal(procBRes.status, 200, 'POST /api/process (Session B) must return HTTP 200');

    // 3.4 Query RAG for Session A via Frontend Proxy and verify zero infrastructure triples & zero Session B leakage
    const firstConceptA = procAData.concepts?.[0]?.name || 'Carbon pricing';
    const ragARes = await fetch(`${frontendBase}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionA,
        query: `What is the role of ${firstConceptA}?`,
        top_k_triples: 15,
      }),
    });
    assert.equal(ragARes.status, 200, 'POST /api/rag/query must return HTTP 200');
    const ragAData = await ragARes.json();
    const retrievedA = ragAData.graph_context?.retrieved_triples || [];
    assert.ok(retrievedA.length > 0, 'RAG query for Session A must retrieve domain triples');

    for (const rt of retrievedA) {
      assert.ok(!rt.predicate.includes('extractedFrom'), `Leaked extractedFrom in retrieved_triples: ${JSON.stringify(rt)}`);
      assert.ok(!rt.subject.startsWith('urn:smartbrief:doc:'), `Leaked doc URN in retrieved_triples subject: ${JSON.stringify(rt)}`);
      assert.ok(!rt.object.startsWith('urn:smartbrief:doc:'), `Leaked doc URN in retrieved_triples object: ${JSON.stringify(rt)}`);
      assert.ok(!rt.raw_triple.includes('extractedFrom'), `Leaked extractedFrom in raw_triple: ${rt.raw_triple}`);
      assert.ok(!rt.raw_triple.includes('urn:smartbrief:doc:'), `Leaked doc URN in raw_triple: ${rt.raw_triple}`);
      assert.ok(!rt.raw_triple.toLowerCase().includes('transmon'), `Cross-session leak from Session B into Session A: ${rt.raw_triple}`);
    }

    // 3.5 Verify GET /api/graph/triplets and GET /api/graph/export via Frontend Proxy
    const allTripletsRes = await fetch(`${frontendBase}/api/graph/triplets`);
    assert.equal(allTripletsRes.status, 200, 'GET /api/graph/triplets must return HTTP 200');
    const allTripletsData = await allTripletsRes.json();
    for (const t of allTripletsData.triplets || []) {
      assert.ok(!t.predicate.includes('extractedFrom'), `Leaked extractedFrom in /api/graph/triplets: ${JSON.stringify(t)}`);
      assert.ok(!t.subject.startsWith('urn:smartbrief:doc:'), `Leaked doc URN in /api/graph/triplets: ${JSON.stringify(t)}`);
      assert.ok(!t.object.startsWith('urn:smartbrief:doc:'), `Leaked doc URN in /api/graph/triplets: ${JSON.stringify(t)}`);
    }

    const exportRes = await fetch(`${frontendBase}/api/graph/export`);
    assert.equal(exportRes.status, 200, 'GET /api/graph/export must return HTTP 200');
    const exportData = await exportRes.json();
    assert.ok(!exportData.content.includes('extractedFrom'), 'Turtle export must not contain extractedFrom');
    assert.ok(!exportData.content.includes('urn:smartbrief:doc:'), 'Turtle export must not contain urn:smartbrief:doc:');
  });
});
