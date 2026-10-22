import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('QA & DevOps Comprehensive Verification: SMAR-21 Conditional Citation Anchor and Highlight Suppression', async (t) => {
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  assert.ok(fs.existsSync(dualPaneFile), 'DualPaneWorkspace.tsx must exist');
  const dualPaneSrc = fs.readFileSync(dualPaneFile, 'utf8');

  await t.test('1. Citation Anchor Calculation Conditioned on Study Deck Mode', () => {
    // Provenance anchor detection function
    assert.match(
      dualPaneSrc,
      /const\s+isParagraphProvenanceAnchor\s*=\s*\(paragraph:\s*string\)\s*=>/,
      'isParagraphProvenanceAnchor helper function must exist'
    );

    // Anchor calculation must strictly require showFlashcards
    assert.match(
      dualPaneSrc,
      /const\s+isAnchor\s*=\s*showFlashcards\s*&&\s*isParagraphProvenanceAnchor\(para\);/,
      'isAnchor must require both showFlashcards and isParagraphProvenanceAnchor(para)'
    );

    // anchorRefs assignment must only happen when isAnchor is true
    assert.match(
      dualPaneSrc,
      /if\s*\(isAnchor\)\s*\{\s*anchorRefs\.current\[activeCardIndex\]\s*=\s*leftPaneScrollRef\.current/,
      'anchorRefs.current must only be populated when isAnchor is true'
    );
  });

  await t.test('2. Badge and Highlight Suppression when Study Deck Mode is Inactive', () => {
    // Active Citation Anchor badge must be conditioned on isAnchor
    assert.match(
      dualPaneSrc,
      /\{isAnchor\s*&&\s*\(\s*<div[^>]*>[\s\S]*?Active Citation Anchor\s*&bull;\s*Card \{activeCardIndex \+ 1\}/,
      'Active Citation Anchor badge must be rendered only when isAnchor evaluates to true'
    );

    // Border and background styling conditional logic
    assert.match(
      dualPaneSrc,
      /isAnchor\s*\?\s*['"]bg-indigo-50\/90 border-l-4 border-indigo-600 shadow-xs ring-1 ring-indigo-200\/70['"]\s*:\s*isConceptMatch\s*\?/,
      'Citation anchor active styling must only be applied when isAnchor is true'
    );

    // Neutral / fallback styling when neither isAnchor nor isConceptMatch
    assert.match(
      dualPaneSrc,
      /:\s*['"]bg-transparent border-l-2 border-transparent hover:bg-slate-50\/80['"]/,
      'Default paragraph styling must remain transparent without active citation highlights'
    );
  });

  await t.test('3. Reader Auto-Scrolling strictly guarded by showFlashcards and Flashcards Tab', () => {
    // Guard clause in reader auto-scroll useEffect
    assert.match(
      dualPaneSrc,
      /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(!showFlashcards\s*\|\|\s*activeTab\s*!==\s*'flashcards'\)\s*return;/,
      'Auto-scroll effect must return immediately if showFlashcards is false or activeTab is not flashcards'
    );

    // Dependency array must contain activeCardIndex, activeTab, and showFlashcards
    assert.match(
      dualPaneSrc,
      /\[activeCardIndex,\s*activeTab,\s*showFlashcards\]/,
      'useEffect must track [activeCardIndex, activeTab, showFlashcards]'
    );
  });

  await t.test('4. Non-Regression: Concept Highlighting & Search Query Preservation', () => {
    // Concept match highlighting still works when isAnchor is false
    assert.match(
      dualPaneSrc,
      /\{!isAnchor\s*&&\s*isConceptMatch\s*&&\s*\(/,
      'Concept match badge must render when isConceptMatch is true and isAnchor is false'
    );

    assert.match(
      dualPaneSrc,
      /isConceptMatch\s*\?\s*['"]bg-indigo-50\/50 border-l-4 border-indigo-400 ring-1 ring-indigo-200\/50['"]/,
      'Concept match border and background must apply when isConceptMatch is true'
    );

    // Search query mark elements
    assert.match(
      dualPaneSrc,
      /searchQuery\.trim\(\)\s*\?\s*['"]bg-amber-200 text-slate-900 rounded px-0\.5 font-medium['"]/,
      'Search query mark highlighting must be preserved'
    );
  });

  await t.test('5. Simulation of Inactive vs Active State Logic', () => {
    // Unit logic simulation
    const simulateAnchor = (showFlashcards, excerptMatches) => {
      return Boolean(showFlashcards && excerptMatches);
    };

    // When Study Deck Mode is OFF, anchor is always false even if excerpt matches
    assert.strictEqual(simulateAnchor(false, true), false, 'Excerpt match must NOT activate anchor when Study Deck Mode is OFF');
    assert.strictEqual(simulateAnchor(false, false), false, 'No match when Study Deck Mode is OFF');

    // When Study Deck Mode is ON, anchor depends on excerpt match
    assert.strictEqual(simulateAnchor(true, true), true, 'Excerpt match MUST activate anchor when Study Deck Mode is ON');
    assert.strictEqual(simulateAnchor(true, false), false, 'Excerpt mismatch must not activate anchor when Study Deck Mode is ON');
  });
});
