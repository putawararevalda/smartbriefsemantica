import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('QA & DevOps Verification: Sprint 2 Dual-Pane Workspace & Active Recall Deck', async (t) => {
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  const flashcardDeckFile = path.join(frontendDir, 'src/components/FlashcardDeck.tsx');
  const globalsCssFile = path.join(frontendDir, 'src/app/globals.css');
  const pageFile = path.join(frontendDir, 'src/app/page.tsx');

  const dualPaneSrc = fs.readFileSync(dualPaneFile, 'utf8');
  const flashcardDeckSrc = fs.readFileSync(flashcardDeckFile, 'utf8');
  const globalsCssSrc = fs.readFileSync(globalsCssFile, 'utf8');
  const pageSrc = fs.readFileSync(pageFile, 'utf8');

  await t.test('CSS 3D Engine & Viewport Transitions', () => {
    // 3D perspective setup
    assert.match(globalsCssSrc, /\.perspective-1000\s*\{[^}]*perspective:\s*1000px/s);
    assert.match(globalsCssSrc, /\.transform-style-3d\s*\{[^}]*transform-style:\s*preserve-3d/s);
    assert.match(globalsCssSrc, /\.backface-hidden\s*\{[^}]*backface-visibility:\s*hidden/s);
    assert.match(globalsCssSrc, /\.rotate-y-180\s*\{[^}]*transform:\s*rotateY\(180deg\)/s);

    // Responsive split ergonomics
    assert.match(dualPaneSrc, /grid-cols-1\s+lg:grid-cols-2/, 'Should render 50/50 split on desktop');
    assert.match(dualPaneSrc, /mobileView\s*===\s*'source'/, 'Should handle mobile toggle for source reader');
    assert.match(dualPaneSrc, /mobileView\s*===\s*'synthesis'/, 'Should handle mobile toggle for synthesis hub');
  });

  await t.test('Left Pane Synchronized Source Reader Architecture', () => {
    // Word count calculation
    assert.match(dualPaneSrc, /trimmed\s*\?\s*trimmed\.split\(\/\\s\+\/\)\.length\s*:\s*0/);
    // Paragraph splitting
    assert.match(dualPaneSrc, /split\(\/\s*\\n\\s\*\\n\s*\/\)/);
    // Reading time estimation
    assert.match(dualPaneSrc, /Math\.ceil\(wordCount\s*\/\s*200\)/);
    // Provenance anchor matching with substring fallback
    assert.match(dualPaneSrc, /function\s+isParagraphProvenanceAnchor|isParagraphProvenanceAnchor\s*=/);
    assert.match(dualPaneSrc, /snippet\.length\s*>=\s*15\s*&&\s*normP\.includes\(snippet\)/);
    // Smooth scroll into view
    assert.match(dualPaneSrc, /targetEl\.scrollIntoView\(\{\s*behavior:\s*'smooth'/);
  });

  await t.test('Right Pane Synthesis Hub Architecture', () => {
    // 3 tabs supported
    assert.match(dualPaneSrc, /type\s+ActiveTab\s*=\s*'flashcards'\s*\|\s*'summary'\s*\|\s*'concepts'/);
    // Flashcard deck component integrated
    assert.match(dualPaneSrc, /<FlashcardDeck\s+/);
    // Markdown copy support
    assert.match(dualPaneSrc, /navigator\.clipboard\.writeText\(summary\)/);
    // Oxigraph concept filtering
    assert.match(dualPaneSrc, /filteredConcepts/);
    assert.match(dualPaneSrc, /conceptFilter/);
  });

  await t.test('Active Recall Retention Mechanics (SuperMemo 4-Point Scale)', () => {
    // Grade types
    assert.match(flashcardDeckSrc, /export\s+type\s+RecallGrade\s*=\s*'again'\s*\|\s*'hard'\s*\|\s*'good'\s*\|\s*'easy'/);
    
    // Config intervals
    assert.match(flashcardDeckSrc, /again:\s*\{[^}]*sublabel:\s*'< 1 min'/s);
    assert.match(flashcardDeckSrc, /hard:\s*\{[^}]*sublabel:\s*'10 min'/s);
    assert.match(flashcardDeckSrc, /good:\s*\{[^}]*sublabel:\s*'1 day'/s);
    assert.match(flashcardDeckSrc, /easy:\s*\{[^}]*sublabel:\s*'3 days'/s);

    // Auto-advance with timer cleanup
    assert.match(flashcardDeckSrc, /advanceTimerRef\.current\s*=\s*setTimeout/);
    assert.match(flashcardDeckSrc, /clearTimeout\(advanceTimerRef\.current\)/);

    // Mastery calculation
    assert.match(flashcardDeckSrc, /masteredCount\s*=\s*Object\.values\(ratings\)\.filter\(r\s*=>\s*r\s*===\s*'good'\s*\|\|\s*r\s*===\s*'easy'\)\.length/);
  });

  await t.test('Keyboard Navigation & Accessibility (WCAG 2.1 AA)', () => {
    // Screen reader live region
    assert.match(flashcardDeckSrc, /<div\s+aria-live="polite"\s+aria-atomic="true"\s+className="sr-only">/);
    // Key bindings
    assert.match(flashcardDeckSrc, /e\.key\s*===\s*' '\s*\|\|\s*e\.key\s*===\s*'Enter'/);
    assert.match(flashcardDeckSrc, /e\.key\s*===\s*'ArrowRight'\s*\|\|\s*e\.key\s*===\s*'j'\s*\|\|\s*e\.key\s*===\s*'J'/);
    assert.match(flashcardDeckSrc, /e\.key\s*===\s*'ArrowLeft'\s*\|\|\s*e\.key\s*===\s*'k'\s*\|\|\s*e\.key\s*===\s*'K'/);
    assert.match(flashcardDeckSrc, /e\.key\s*===\s*'1'/);
    assert.match(flashcardDeckSrc, /e\.key\s*===\s*'2'/);
    assert.match(flashcardDeckSrc, /e\.key\s*===\s*'3'/);
    assert.match(flashcardDeckSrc, /e\.key\s*===\s*'4'/);

    // Form input safety bypass
    assert.match(flashcardDeckSrc, /tagName\s*===\s*'input'\s*\|\|\s*tagName\s*===\s*'textarea'/);
  });

  await t.test('Defensive Edge Cases', () => {
    // 1-card deck disable check
    assert.match(flashcardDeckSrc, /disabled=\{currentIndex\s*===\s*0\}/);
    assert.match(flashcardDeckSrc, /disabled=\{currentIndex\s*===\s*totalCards\s*-\s*1\}/);
    // Long text scroll
    assert.match(flashcardDeckSrc, /overflow-y-auto/);
    // Focusable card region
    assert.match(flashcardDeckSrc, /tabIndex=\{0\}/);
  });

  await t.test('Live Container E2E Integration Contract', async () => {
    const payload = {
      text: 'Oxigraph is a graph database implementing the SPARQL 1.1 Query and Update standards. It serves as an embedded triple store for knowledge representation.'
    };

    const response = await fetch('http://localhost:3003/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(response.status, 200, 'Next.js proxy must return 200 OK from backend');
    const data = await response.json();

    assert.ok(Array.isArray(data.flashcards), 'Result must contain flashcards array');
    assert.ok(data.flashcards.length > 0, 'Must have at least 1 flashcard');
    assert.ok(Array.isArray(data.graph_nodes || data.concepts), 'Must contain graph concepts');

    const card = data.flashcards[0];
    assert.ok(typeof card.question === 'string' && card.question.length > 5, 'Flashcard must have valid question');
    assert.ok(typeof card.answer === 'string' && card.answer.length > 5, 'Flashcard must have valid answer');
    assert.ok(card.provenance, 'Flashcard must include provenance metadata');
    assert.ok(card.provenance.node_id || card.provenance.concept, 'Provenance must link to an Oxigraph node');
  });
});
