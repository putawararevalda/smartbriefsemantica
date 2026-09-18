import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('Frontend Project Structure & Deliverables Verification', async (t) => {
  await t.test('Next.js configuration files exist', () => {
    assert.ok(fs.existsSync(path.join(frontendDir, 'package.json')), 'package.json must exist');
    assert.ok(fs.existsSync(path.join(frontendDir, 'next.config.js')), 'next.config.js must exist');
    assert.ok(fs.existsSync(path.join(frontendDir, 'tsconfig.json')), 'tsconfig.json must exist');
    assert.ok(fs.existsSync(path.join(frontendDir, 'tailwind.config.js')), 'tailwind.config.js must exist');
    assert.ok(fs.existsSync(path.join(frontendDir, 'Dockerfile')), 'Dockerfile must exist');
  });

  await t.test('Next.js is configured for standalone output', () => {
    const configContent = fs.readFileSync(path.join(frontendDir, 'next.config.js'), 'utf-8');
    assert.match(configContent, /output:\s*['"]standalone['"]/, 'next.config.js must specify standalone output');
  });

  await t.test('Required UI components exist with PRD-specified features', () => {
    const inputForm = fs.readFileSync(path.join(frontendDir, 'src/components/InputForm.tsx'), 'utf-8');
    assert.match(inputForm, /wordCount|word/i, 'InputForm must track word count');
    assert.match(inputForm, /charCount|character/i, 'InputForm must track character count');
    assert.match(inputForm, /Load Sample Article/i, 'InputForm must include sample loader button');

    const flashcardItem = fs.readFileSync(path.join(frontendDir, 'src/components/FlashcardItem.tsx'), 'utf-8');
    assert.match(flashcardItem, /Trace Source/i, 'FlashcardItem must contain "Trace Source" button');
    assert.match(flashcardItem, /showAnswer/i, 'FlashcardItem must support toggling answer visibility');

    const provenanceModal = fs.readFileSync(path.join(frontendDir, 'src/components/ProvenanceModal.tsx'), 'utf-8');
    assert.match(provenanceModal, /Oxigraph/i, 'ProvenanceModal must reference Oxigraph store');
    assert.match(provenanceModal, /audit_trail|audit/i, 'ProvenanceModal must display audit trail');
    assert.match(provenanceModal, /confidence/i, 'ProvenanceModal must display confidence');
    assert.match(provenanceModal, /showRawJson/i, 'ProvenanceModal must allow raw JSON inspection');
  });

  await t.test('API Route Handler defines resilient fallback logic', () => {
    const routeHandler = fs.readFileSync(path.join(frontendDir, 'src/app/api/process/route.ts'), 'utf-8');
    assert.match(routeHandler, /getFallbackResponse/, 'route.ts must implement getFallbackResponse for standalone resilience');
    assert.match(routeHandler, /status:\s*400/, 'route.ts must validate inputs and return 400 for empty text');
    assert.match(routeHandler, /BACKEND_INTERNAL_URL/, 'route.ts must respect BACKEND_INTERNAL_URL environment variable');
  });
});

test('API Live Integration Tests (against running container)', async (t) => {
  const containerUrl = process.env.TEST_FRONTEND_URL || 'http://localhost:3003';

  let isAlive = false;
  try {
    const healthCheck = await fetch(containerUrl, { method: 'GET' });
    isAlive = healthCheck.ok;
  } catch {
    isAlive = false;
  }

  if (!isAlive) {
    t.skip(`Frontend container not running at ${containerUrl}. Skipping live integration suite.`);
    return;
  }

  await t.test('POST /api/process returns 400 for missing or empty text', async () => {
    const res = await fetch(`${containerUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error, 'Response must include error message');
  });

  await t.test('POST /api/process returns 200 with compliant Semantica schema for valid input', async () => {
    const sampleInput = 'Knowledge graphs with Oxigraph store semantic relationships and provenance trails.';
    const res = await fetch(`${containerUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sampleInput })
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.summary && typeof data.summary === 'string', 'summary must be a string');
    assert.ok(Array.isArray(data.graph_nodes), 'graph_nodes must be an array');
    assert.ok(data.graph_nodes.length >= 3, 'must extract at least 3 graph nodes');
    assert.ok(Array.isArray(data.flashcards), 'flashcards must be an array');
    assert.ok(data.flashcards.length >= 3, 'must generate at least 3 flashcards');

    const card = data.flashcards[0];
    assert.ok(card.question, 'flashcard must have a question');
    assert.ok(card.answer, 'flashcard must have an answer');
    assert.ok(card.provenance, 'flashcard must have provenance');
    assert.ok(card.provenance.node_id, 'provenance must include node_id');
    assert.ok(card.provenance.source_excerpt, 'provenance must include source_excerpt');
    assert.ok(typeof card.provenance.confidence === 'number', 'provenance confidence must be a number');
    assert.ok(Array.isArray(card.provenance.audit_trail), 'audit_trail must be an array of steps');
  });
});
