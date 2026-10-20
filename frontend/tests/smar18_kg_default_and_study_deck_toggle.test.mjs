import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('SMAR-18: Knowledge Graph Default Landing View & Study Deck Mode Toggle Verification', async (t) => {
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  const ingestionHubFile = path.join(frontendDir, 'src/components/IngestionHub.tsx');
  const progressStepperFile = path.join(frontendDir, 'src/components/ProgressStepper.tsx');

  assert.ok(fs.existsSync(dualPaneFile), 'DualPaneWorkspace.tsx must exist');
  assert.ok(fs.existsSync(ingestionHubFile), 'IngestionHub.tsx must exist');
  assert.ok(fs.existsSync(progressStepperFile), 'ProgressStepper.tsx must exist');

  const dualPaneSrc = fs.readFileSync(dualPaneFile, 'utf8');
  const ingestionHubSrc = fs.readFileSync(ingestionHubFile, 'utf8');
  const progressStepperSrc = fs.readFileSync(progressStepperFile, 'utf8');

  await t.test('1. Default Landing View Pivot to Knowledge Graph (tab-graph)', () => {
    // Default activeTab initialization must be 'graph'
    assert.match(
      dualPaneSrc,
      /const\s+\[activeTab,\s*setActiveTab\]\s*=\s*useState<ActiveTab>\('graph'\)/,
      'activeTab state must initialize to "graph" as the default post-ingestion landing view'
    );

    // Verify tab ordering in right pane tablist:
    // 1. tab-graph, 2. tab-qa, 3. tab-concepts, 4. tab-summary, 5. tab-flashcards
    const tabGraphPos = dualPaneSrc.indexOf('id="tab-graph"');
    const tabQaPos = dualPaneSrc.indexOf('id="tab-qa"');
    const tabConceptsPos = dualPaneSrc.indexOf('id="tab-concepts"');
    const tabSummaryPos = dualPaneSrc.indexOf('id="tab-summary"');
    const tabFlashcardsPos = dualPaneSrc.indexOf('id="tab-flashcards"');

    assert.ok(tabGraphPos > 0, 'tab-graph must exist in DualPaneWorkspace');
    assert.ok(tabQaPos > tabGraphPos, 'tab-qa (Ask KG) must follow tab-graph');
    assert.ok(tabConceptsPos > tabQaPos, 'tab-concepts must follow tab-qa');
    assert.ok(tabSummaryPos > tabConceptsPos, 'tab-summary must follow tab-concepts');
    assert.ok(tabFlashcardsPos > tabSummaryPos, 'tab-flashcards must be ordered last (after tab-summary)');
  });

  await t.test('2. Study Deck Mode Toggle Control, State, and Accessibility (WCAG 2.1 AA)', () => {
    // Default showFlashcards state initialized to false
    assert.match(
      dualPaneSrc,
      /const\s+\[showFlashcards,\s*setShowFlashcards\]\s*=\s*useState<boolean>\(false\)/,
      'showFlashcards must initialize to false (Study Deck Mode OFF by default)'
    );

    // Accessible switch attributes
    assert.match(dualPaneSrc, /role="switch"/, 'Study Deck Mode toggle must have role="switch"');
    assert.match(dualPaneSrc, /aria-checked=\{showFlashcards\}/, 'Study Deck Mode toggle must bind aria-checked={showFlashcards}');
    assert.match(dualPaneSrc, /aria-label="Toggle Study Deck Mode"/, 'Study Deck Mode toggle must have aria-label="Toggle Study Deck Mode"');
    assert.match(dualPaneSrc, />Study Deck Mode<\/span>/, 'Toggle control must be explicitly labeled "Study Deck Mode"');
  });

  await t.test('3. LocalStorage Persistence & Auto-Navigation Fallback', () => {
    // LocalStorage getItem / setItem
    assert.match(
      dualPaneSrc,
      /localStorage\.getItem\('smartbrief_show_flashcards'\)/,
      'Must read smartbrief_show_flashcards from localStorage'
    );
    assert.match(
      dualPaneSrc,
      /localStorage\.setItem\('smartbrief_show_flashcards',\s*String\(next\)\)/,
      'Must persist smartbrief_show_flashcards to localStorage'
    );

    // Conditional rendering of tab-flashcards and tabpanel-flashcards
    assert.match(
      dualPaneSrc,
      /\{showFlashcards\s*&&\s*\(\s*<button[\s\S]*?id="tab-flashcards"/,
      'tab-flashcards button must be conditionally rendered when showFlashcards is true'
    );
    assert.match(
      dualPaneSrc,
      /\{showFlashcards\s*&&\s*activeTab\s*===\s*'flashcards'\s*&&/,
      'Flashcards tabpanel must be conditionally rendered when showFlashcards is true'
    );

    // Conditional rendering of "Jump to Flashcard" button on concept cards
    assert.match(
      dualPaneSrc,
      /\{showFlashcards\s*&&\s*matchingFlashcardIdx\s*!==\s*-1\s*&&/,
      'Concept card Jump to Flashcard button must be hidden when showFlashcards is false'
    );

    // Auto-navigation fallback from 'flashcards' to 'graph' when toggled OFF
    assert.match(
      dualPaneSrc,
      /if\s*\(!showFlashcards\s*&&\s*activeTab\s*===\s*'flashcards'\)\s*\{\s*setActiveTab\('graph'\)/,
      'Must automatically redirect activeTab from flashcards to graph when Study Deck Mode is turned OFF'
    );
  });

  await t.test('4. Synthesis Sub-Header Knowledge Graph Intelligence Metrics', () => {
    // When Study Deck Mode is OFF (!showFlashcards), display Entities, Triples, and 100% PROV-O Grounded
    assert.match(dualPaneSrc, /\{concepts\.length\}\s*Entities/, 'Must display total Entities count');
    assert.match(dualPaneSrc, /\{tripletCount\}\s*Triples/, 'Must display total Triples count');
    assert.match(dualPaneSrc, /100% PROV-O Grounded/, 'Must display Cryptographic Provenance Status (100% PROV-O Grounded)');
  });

  await t.test('5. Ingestion Status Copy Alignment', () => {
    assert.match(
      ingestionHubSrc,
      /Analyze & Build Knowledge Graph/,
      'IngestionHub submit button must emphasize Knowledge Graph construction'
    );
    assert.match(
      progressStepperSrc,
      /Constructing Knowledge Graph, Subgraph Grounding & Provenance Lineage/i,
      'ProgressStepper header must emphasize knowledge graph construction and subgraph grounding'
    );
  });
});
