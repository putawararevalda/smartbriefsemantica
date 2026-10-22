import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('SMAR-21: Citation Anchor Badge and Highlight Conditional Visibility Verification', async (t) => {
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  assert.ok(fs.existsSync(dualPaneFile), 'DualPaneWorkspace.tsx must exist');
  const dualPaneSrc = fs.readFileSync(dualPaneFile, 'utf8');

  await t.test('1. Conditional Anchor Computation (isAnchor conditioned on showFlashcards)', () => {
    // Verify isAnchor incorporates showFlashcards
    assert.match(
      dualPaneSrc,
      /const\s+isAnchor\s*=\s*showFlashcards\s*&&\s*isParagraphProvenanceAnchor\(para\)/,
      'isAnchor must require both showFlashcards to be truthy and isParagraphProvenanceAnchor(para) to match'
    );
  });

  await t.test('2. Badge and Highlight Suppression when Study Deck Mode is Inactive', () => {
    // When showFlashcards is false, isAnchor evaluates to false.
    // Ensure Active Citation Anchor badge is only rendered when isAnchor is true
    assert.match(
      dualPaneSrc,
      /\{isAnchor\s*&&\s*\(\s*<div[^>]*>[\s\S]*?Active Citation Anchor\s*&bull;\s*Card \{activeCardIndex \+ 1\}<\/span>/,
      'Active Citation Anchor badge must be enclosed in isAnchor condition'
    );

    // Ensure anchor background/border highlight class is only applied when isAnchor is true
    assert.match(
      dualPaneSrc,
      /isAnchor\s*\?\s*['"]bg-indigo-50\/90 border-l-4 border-indigo-600 shadow-xs ring-1 ring-indigo-200\/70['"]/,
      'Anchor highlight styling (bg-indigo-50/90 border-l-4 border-indigo-600) must only be used when isAnchor is true'
    );
  });

  await t.test('3. Anchor Scrolling & Ref Updates Guarded by showFlashcards', () => {
    // useEffect auto-scroll must check !showFlashcards || activeTab !== 'flashcards'
    assert.match(
      dualPaneSrc,
      /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(!showFlashcards\s*\|\|\s*activeTab\s*!==\s*'flashcards'\)\s*return;/,
      'Auto-scroll to active provenance anchor must guard against showFlashcards being false'
    );

    // Dependency array must include showFlashcards
    assert.match(
      dualPaneSrc,
      /\},\s*\[activeCardIndex,\s*activeTab,\s*showFlashcards\]\);/,
      'Auto-scroll useEffect dependency array must include showFlashcards'
    );
  });

  await t.test('4. No Regression for Concept Matching and Search Query Highlighting', () => {
    // isConceptMatch badge rendering when isAnchor is false
    assert.match(
      dualPaneSrc,
      /\{!isAnchor\s*&&\s*isConceptMatch\s*&&/,
      'Referenced Concept badge must render when isConceptMatch is true and isAnchor is false'
    );

    // Concept styling fallback
    assert.match(
      dualPaneSrc,
      /isConceptMatch\s*\?\s*['"]bg-indigo-50\/50 border-l-4 border-indigo-400 ring-1 ring-indigo-200\/50['"]/,
      'Concept match styling must apply when isConceptMatch is true and isAnchor is false'
    );

    // Search query mark highlighting exists
    assert.match(
      dualPaneSrc,
      /searchQuery\.trim\(\)\s*\?\s*['"]bg-amber-200 text-slate-900 rounded px-0\.5 font-medium['"]/,
      'Search query highlight must function independently of Study Deck Mode'
    );
  });
});
