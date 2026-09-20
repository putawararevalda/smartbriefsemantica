import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('SMAR-10: Flashcards and Concepts badges & tabs clickability verification', async (t) => {
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  assert.ok(fs.existsSync(dualPaneFile), 'DualPaneWorkspace.tsx must exist');
  const src = fs.readFileSync(dualPaneFile, 'utf8');

  await t.test('Tab Buttons have proper accessibility roles, cursor styles, and tablist container', () => {
    // Tablist container
    assert.match(src, /role="tablist"/, 'Tabs container must have role="tablist"');

    // Tab buttons have role="tab", cursor-pointer, and aria attributes
    assert.match(src, /role="tab"[\s\S]{1,120}id="tab-flashcards"[\s\S]{1,120}aria-selected=\{activeTab === 'flashcards'\}/,
      'Flashcards button must have role="tab", id, and aria-selected');
    assert.match(src, /role="tab"[\s\S]{1,120}id="tab-summary"[\s\S]{1,120}aria-selected=\{activeTab === 'summary'\}/,
      'Summary button must have role="tab", id, and aria-selected');
    assert.match(src, /role="tab"[\s\S]{1,120}id="tab-concepts"[\s\S]{1,120}aria-selected=\{activeTab === 'concepts'\}/,
      'Concepts button must have role="tab", id, and aria-selected');

    // All tab buttons have cursor-pointer
    assert.match(src, /id="tab-flashcards"[\s\S]{1,300}cursor-pointer/, 'Flashcards tab must have cursor-pointer');
    assert.match(src, /id="tab-summary"[\s\S]{1,300}cursor-pointer/, 'Summary tab must have cursor-pointer');
    assert.match(src, /id="tab-concepts"[\s\S]{1,300}cursor-pointer/, 'Concepts tab must have cursor-pointer');
  });

  await t.test('Badges have explicit click handlers, keyboard support, and cursor-pointer', () => {
    // Flashcards badge
    assert.match(src, /handleBadgeClick\('flashcards',\s*e\)/, 'Flashcards badge must have explicit onClick calling handleBadgeClick');
    assert.match(src, /onClick=\{\(e\)\s*=>\s*handleBadgeClick\('flashcards',\s*e\)\}/,
      'Flashcards badge must have onClick handler binding');
    assert.match(src, /aria-label=\{`View \$\{flashcards\.length\} flashcards`\}/,
      'Flashcards badge must have descriptive aria-label');

    // Concepts badge
    assert.match(src, /handleBadgeClick\('concepts',\s*e\)/, 'Concepts badge must have explicit onClick calling handleBadgeClick');
    assert.match(src, /onClick=\{\(e\)\s*=>\s*handleBadgeClick\('concepts',\s*e\)\}/,
      'Concepts badge must have onClick handler binding');
    assert.match(src, /aria-label=\{`View \$\{concepts\.length\} concepts`\}/,
      'Concepts badge must have descriptive aria-label');

    // Role, tabIndex, and keyboard support
    assert.match(src, /role="button"[\s\S]{1,50}tabIndex=\{0\}[\s\S]{1,120}handleBadgeClick/,
      'Badges must have role="button" and tabIndex={0} for interactive accessibility');
    assert.match(src, /onKeyDown=\{\(e\)\s*=>\s*\{[\s\S]*?e\.key\s*===\s*'Enter'[\s\S]*?handleTabChange\('flashcards'\)/,
      'Flashcards badge must support keyboard activation via Enter/Space');
    assert.match(src, /onKeyDown=\{\(e\)\s*=>\s*\{[\s\S]*?e\.key\s*===\s*'Enter'[\s\S]*?handleTabChange\('concepts'\)/,
      'Concepts badge must support keyboard activation via Enter/Space');
  });

  await t.test('Event Propagation: Badge clicks stopPropagation and prevent event swallowing', () => {
    // stopPropagation inside handleBadgeClick
    assert.match(src, /const\s+handleBadgeClick\s*=\s*\([^)]*\)\s*=>\s*\{[^}]*e\.stopPropagation\(\)/s,
      'handleBadgeClick must invoke e.stopPropagation() to isolate badge interaction');

    // Child elements (icons and text) have pointer-events-none to prevent touch swallowing
    assert.match(src, /<Layers[^>]*pointer-events-none/, 'Flashcards icon must have pointer-events-none');
    assert.match(src, /<Network[^>]*pointer-events-none/, 'Concepts icon must have pointer-events-none');
    assert.match(src, /<AlignLeft[^>]*pointer-events-none/, 'Summary icon must have pointer-events-none');
    assert.match(src, /<span className="pointer-events-none select-none">Flashcards<\/span>/,
      'Flashcards label must have pointer-events-none and select-none');
    assert.match(src, /<span className="pointer-events-none select-none">Concepts<\/span>/,
      'Concepts label must have pointer-events-none and select-none');
  });

  await t.test('Active Tab re-click triggers contextual scroll / reset action', () => {
    // Re-clicking active tab triggers contextual action
    assert.match(src, /flashcardDeckRef\.current\?\.scrollIntoView/,
      'Flashcards active tab re-click must scroll deck into view');
    assert.match(src, /conceptMatrixRef\.current\?\.scrollIntoView/,
      'Concepts active tab re-click must scroll matrix into view');
    assert.match(src, /setConceptFilter\(''\)/,
      'Concepts active tab re-click must reset concept filter');

    // Tab panels have IDs and ARIA bindings
    assert.match(src, /id="tabpanel-flashcards"\s+role="tabpanel"\s+aria-labelledby="tab-flashcards"/,
      'Flashcards panel must have tabpanel role and aria-labelledby');
    assert.match(src, /id="tabpanel-summary"\s+role="tabpanel"\s+aria-labelledby="tab-summary"/,
      'Summary panel must have tabpanel role and aria-labelledby');
    assert.match(src, /id="tabpanel-concepts"\s+role="tabpanel"\s+aria-labelledby="tab-concepts"/,
      'Concepts panel must have tabpanel role and aria-labelledby');
  });

  await t.test('Concept Cards are interactive with click-to-highlight and flashcard deep-links', () => {
    // Concept card interactive affordances
    assert.match(src, /role="button"\s+tabIndex=\{0\}\s+onClick=\{\(\)\s*=>\s*setHighlightedConcept/s,
      'Concept cards must be clickable buttons that toggle highlightedConcept');
    assert.match(src, /cursor-pointer[^"]*border[^"]*transition-all/,
      'Concept cards must visually indicate clickability via cursor-pointer');
    assert.match(src, /isHighlighted\s*\?[^:]*border-indigo-500/s,
      'Highlighted concept card must display active styling');

    // Deep link to matching flashcard
    assert.match(src, /matchingFlashcardIdx\s*!==\s*-1/,
      'Concept card must identify matching flashcard');
    assert.match(src, /handleTabChange\('flashcards'\)/,
      'Clicking concept flashcard link must switch to Flashcards tab');
    assert.match(src, /setActiveCardIndex\(matchingFlashcardIdx\)/,
      'Clicking concept flashcard link must set matching active card index');

    // Left pane highlights active concept
    assert.match(src, /mentionsHighlightedConcept|isConceptMatch|activeHighlight/,
      'Left pane reader must highlight active concept in source text');
  });
});
