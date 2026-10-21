import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('SMAR-19: Filter internal extractedFrom and Document bookkeeping triples from UI and API responses', async (t) => {
  const drawerFile = path.join(frontendDir, 'src/components/SubgraphEvidenceDrawer.tsx');
  const explorerFile = path.join(frontendDir, 'src/components/KnowledgeGraphExplorer.tsx');
  const qaFile = path.join(frontendDir, 'src/components/KnowledgeGraphQA.tsx');

  const drawerSrc = fs.readFileSync(drawerFile, 'utf8');
  const explorerSrc = fs.readFileSync(explorerFile, 'utf8');
  const qaSrc = fs.readFileSync(qaFile, 'utf8');

  await t.test('1. SubgraphEvidenceDrawer defensively filters extractedFrom and urn:smartbrief:doc: triples', () => {
    assert.match(
      drawerSrc,
      /export function isInfrastructureTriple/,
      'SubgraphEvidenceDrawer must define isInfrastructureTriple helper'
    );
    assert.match(
      drawerSrc,
      /extractedFrom/,
      'SubgraphEvidenceDrawer filter must check for extractedFrom predicate'
    );
    assert.match(
      drawerSrc,
      /urn:smartbrief:doc:/,
      'SubgraphEvidenceDrawer filter must check for urn:smartbrief:doc: subject/object'
    );
    assert.match(
      drawerSrc,
      /ontology\/Document/,
      'SubgraphEvidenceDrawer filter must check for ontology/Document object'
    );
    assert.match(
      drawerSrc,
      /\(graphContext\?\.retrieved_triples \|\| \[\]\)\.filter\(\(t\) => !isInfrastructureTriple\(t\)\)/,
      'SubgraphEvidenceDrawer must filter graphContext.retrieved_triples via isInfrastructureTriple'
    );
  });

  await t.test('2. KnowledgeGraphExplorer defensively filters extractedFrom and urn:smartbrief:doc: triples', () => {
    assert.match(
      explorerSrc,
      /export function isInfrastructureTriple/,
      'KnowledgeGraphExplorer must define isInfrastructureTriple helper'
    );
    assert.match(
      explorerSrc,
      /extractedFrom/,
      'KnowledgeGraphExplorer filter must check for extractedFrom predicate'
    );
    assert.match(
      explorerSrc,
      /urn:smartbrief:doc:/,
      'KnowledgeGraphExplorer filter must check for urn:smartbrief:doc: subject/object'
    );
    assert.match(
      explorerSrc,
      /graph\.triplets\.filter\(\(t\) => !isInfrastructureTriple\(t\)\)/,
      'KnowledgeGraphExplorer must filter graph.triplets via isInfrastructureTriple'
    );
    assert.match(
      explorerSrc,
      /initialTriplets\.filter\(\(t\) => !isInfrastructureTriple\(t\)\)/,
      'KnowledgeGraphExplorer must filter initialTriplets via isInfrastructureTriple'
    );
    assert.match(
      explorerSrc,
      /data\.triplets\.filter\(\(t: TripletItem\) => !isInfrastructureTriple\(t\)\)/,
      'KnowledgeGraphExplorer fetchAllTriplets must filter fetched triplets via isInfrastructureTriple'
    );
  });

  await t.test('3. KnowledgeGraphQA badge count excludes infrastructure triples', () => {
    assert.match(
      qaSrc,
      /import SubgraphEvidenceDrawer, \{ isInfrastructureTriple \} from '\.\/SubgraphEvidenceDrawer'/,
      'KnowledgeGraphQA must import isInfrastructureTriple from SubgraphEvidenceDrawer'
    );
    assert.match(
      qaSrc,
      /!isInfrastructureTriple\(t\)/,
      'KnowledgeGraphQA must exclude infrastructure triples from tripleCount badge'
    );
  });

  await t.test('4. Live API Endpoints exclude extractedFrom and urn:smartbrief:doc: triples', async () => {
    const frontendBase = process.env.TEST_FRONTEND_URL || 'http://localhost:3003';
    let isReachable = false;
    try {
      const probe = await fetch(`${frontendBase}/api/graph/triplets`);
      isReachable = probe.ok;
    } catch {
      isReachable = false;
    }
    if (!isReachable) return;

    const envArticle =
      'Environmental economics analyzes the financial impact of environmental policies and market externalities. ' +
      'Carbon pricing mechanisms, such as emissions trading systems and carbon taxes, internalize the social cost ' +
      'of greenhouse gas emissions and incentivize transition toward a circular economy and renewable energy.';

    const procRes = await fetch(`${frontendBase}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: envArticle }),
    });
    assert.strictEqual(procRes.status, 200, 'POST /api/process must return HTTP 200');
    const procData = await procRes.json();
    const triplets = procData.graph?.triplets || [];
    assert.ok(triplets.length > 0, 'POST /api/process must return domain triplets');
    for (const t of triplets) {
      assert.ok(!t.predicate.includes('extractedFrom'), `Unexpected extractedFrom in graph.triplets: ${JSON.stringify(t)}`);
      assert.ok(!t.subject.startsWith('urn:smartbrief:doc:'), `Unexpected doc URN in graph.triplets subject: ${JSON.stringify(t)}`);
      assert.ok(!t.object.startsWith('urn:smartbrief:doc:'), `Unexpected doc URN in graph.triplets object: ${JSON.stringify(t)}`);
    }

    const sessionId = procData.provenance_summary?.session_id || 'proc_test_smar19';
    const firstConcept = procData.concepts?.[0]?.name || procData.graph_nodes?.[0]?.label || 'Carbon pricing';
    const ragRes = await fetch(`${frontendBase}/api/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        query: `How does ${firstConcept} work?`,
        top_k_triples: 15,
      }),
    });
    assert.strictEqual(ragRes.status, 200, 'POST /api/rag/query must return HTTP 200');
    const ragData = await ragRes.json();
    const retrieved = ragData.graph_context?.retrieved_triples || [];
    for (const rt of retrieved) {
      assert.ok(!rt.predicate.includes('extractedFrom'), `Unexpected extractedFrom in retrieved_triples: ${JSON.stringify(rt)}`);
      assert.ok(!rt.subject.startsWith('urn:smartbrief:doc:'), `Unexpected doc URN in retrieved_triples subject: ${JSON.stringify(rt)}`);
      assert.ok(!rt.object.startsWith('urn:smartbrief:doc:'), `Unexpected doc URN in retrieved_triples object: ${JSON.stringify(rt)}`);
    }
  });
});
