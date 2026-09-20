import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('QA & DevOps Comprehensive Verification: SMAR-10 Badge and Tab Interactivity', async (t) => {
  const dualPanePath = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  assert.ok(fs.existsSync(dualPanePath), 'DualPaneWorkspace.tsx component exists');
  const src = fs.readFileSync(dualPanePath, 'utf8');

  await t.test('1. Touch Event Hardening on Mobile Viewports', () => {
    // Child SVG icons inside tab buttons must have pointer-events-none to prevent touch swallowing
    assert.match(src, /<Layers[^>]*pointer-events-none[^>]*\/>/, 'Layers icon in Flashcards tab must have pointer-events-none');
    assert.match(src, /<AlignLeft[^>]*pointer-events-none[^>]*\/>/, 'AlignLeft icon in Summary tab must have pointer-events-none');
    assert.match(src, /<Network[^>]*pointer-events-none[^>]*\/>/, 'Network icon in Concepts tab must have pointer-events-none');

    // Mobile view switch buttons must also have pointer-events-none and select-none on children
    assert.match(src, /<FileText[^>]*pointer-events-none[^>]*\/>/, 'FileText icon in mobile toggle must have pointer-events-none');
    assert.match(src, /<span className="pointer-events-none select-none">Source Document/, 'Mobile Source toggle text must have pointer-events-none and select-none');
    assert.match(src, /<span className="pointer-events-none select-none">Synthesis & Study Hub/, 'Mobile Synthesis toggle text must have pointer-events-none and select-none');

    // Tab labels must have pointer-events-none select-none
    assert.match(src, /<span className="pointer-events-none select-none">Flashcards<\/span>/, 'Flashcards label must have pointer-events-none and select-none');
    assert.match(src, /<span className="pointer-events-none select-none">Summary<\/span>/, 'Summary label must have pointer-events-none and select-none');
    assert.match(src, /<span className="pointer-events-none select-none">Concepts<\/span>/, 'Concepts label must have pointer-events-none and select-none');
  });

  await t.test('2. Badge Dedicated Click Handling & Event Isolation', () => {
    // Isolated event handler definition
    assert.match(src, /const\s+handleBadgeClick\s*=\s*\(\s*tab:\s*ActiveTab,\s*e:\s*React\.MouseEvent\s*\)\s*=>\s*\{/,
      'handleBadgeClick must accept tab and mouse event');
    assert.match(src, /e\.stopPropagation\(\)/, 'handleBadgeClick must invoke e.stopPropagation()');

    // Flashcards badge attributes
    assert.match(src, /handleBadgeClick\('flashcards',\s*e\)/, 'Flashcards badge must pass "flashcards" to handleBadgeClick');
    assert.match(src, /aria-label=\{`View \$\{flashcards\.length\} flashcards`\}/, 'Flashcards badge must provide dynamic aria-label');
    assert.match(src, /title=\{`Click badge to view \$\{flashcards\.length\} flashcards`\}/, 'Flashcards badge must provide tooltip title');

    // Concepts badge attributes
    assert.match(src, /handleBadgeClick\('concepts',\s*e\)/, 'Concepts badge must pass "concepts" to handleBadgeClick');
    assert.match(src, /aria-label=\{`View \$\{concepts\.length\} concepts`\}/, 'Concepts badge must provide dynamic aria-label');
    assert.match(src, /title=\{`Click badge to view \$\{concepts\.length\} concepts`\}/, 'Concepts badge must provide tooltip title');

    // Interactive styling and micro-interactions
    assert.match(src, /hover:scale-110\s+active:scale-95/, 'Badges must have responsive micro-interaction transitions');
  });

  await t.test('3. WCAG 2.1 AA Semantic Roles & Keyboard Accessibility', () => {
    // Tablist container role
    assert.match(src, /role="tablist"\s+aria-label="Synthesis and study hub tabs"/,
      'Tabs wrapper must have role="tablist" with descriptive label');

    // Tab buttons have role="tab", aria-selected, and aria-controls
    assert.match(src, /role="tab"[\s\S]*?id="tab-flashcards"[\s\S]*?aria-selected=\{activeTab === 'flashcards'\}[\s\S]*?aria-controls="tabpanel-flashcards"/,
      'Flashcards tab must have role="tab", aria-selected, and aria-controls="tabpanel-flashcards"');
    assert.match(src, /role="tab"[\s\S]*?id="tab-summary"[\s\S]*?aria-selected=\{activeTab === 'summary'\}[\s\S]*?aria-controls="tabpanel-summary"/,
      'Summary tab must have role="tab", aria-selected, and aria-controls="tabpanel-summary"');
    assert.match(src, /role="tab"[\s\S]*?id="tab-concepts"[\s\S]*?aria-selected=\{activeTab === 'concepts'\}[\s\S]*?aria-controls="tabpanel-concepts"/,
      'Concepts tab must have role="tab", aria-selected, and aria-controls="tabpanel-concepts"');

    // Badges have role="button", tabIndex={0}, and keyboard support
    assert.match(src, /role="button"\s+tabIndex=\{0\}[\s\S]*?handleBadgeClick\('flashcards'/,
      'Flashcards badge must have role="button" and tabIndex={0}');
    assert.match(src, /role="button"\s+tabIndex=\{0\}[\s\S]*?handleBadgeClick\('concepts'/,
      'Concepts badge must have role="button" and tabIndex={0}');

    // Keyboard event handler for badges
    assert.match(src, /if\s*\(\s*e\.key\s*===\s*'Enter'\s*\|\|\s*e\.key\s*===\s*'\s*'\s*\)\s*\{[\s\S]*?e\.preventDefault\(\);[\s\S]*?e\.stopPropagation\(\);[\s\S]*?handleTabChange\('flashcards'\);/,
      'Flashcards badge must handle Enter and Space keydown events');
    assert.match(src, /if\s*\(\s*e\.key\s*===\s*'Enter'\s*\|\|\s*e\.key\s*===\s*'\s*'\s*\)\s*\{[\s\S]*?e\.preventDefault\(\);[\s\S]*?e\.stopPropagation\(\);[\s\S]*?handleTabChange\('concepts'\);/,
      'Concepts badge must handle Enter and Space keydown events');

    // Tabpanel associations
    assert.match(src, /id="tabpanel-flashcards"\s+role="tabpanel"\s+aria-labelledby="tab-flashcards"/,
      'Flashcards tabpanel must have role="tabpanel" linked to tab-flashcards');
    assert.match(src, /id="tabpanel-summary"\s+role="tabpanel"\s+aria-labelledby="tab-summary"/,
      'Summary tabpanel must have role="tabpanel" linked to tab-summary');
    assert.match(src, /id="tabpanel-concepts"\s+role="tabpanel"\s+aria-labelledby="tab-concepts"/,
      'Concepts tabpanel must have role="tabpanel" linked to tab-concepts');
  });

  await t.test('4. Active Tab Re-Click Contextual Behavior', () => {
    // Re-clicking active tab triggers contextual scrolling / reset
    assert.match(src, /flashcardDeckRef\.current\?\.scrollIntoView\(\{\s*behavior:\s*'smooth',\s*block:\s*'nearest'\s*\}\)/,
      'Re-clicking Flashcards must smoothly scroll flashcard deck into view');
    assert.match(src, /conceptMatrixRef\.current\?\.scrollIntoView\(\{\s*behavior:\s*'smooth',\s*block:\s*'nearest'\s*\}\)/,
      'Re-clicking Concepts must smoothly scroll concept matrix into view');
    assert.match(src, /setConceptFilter\(''\)/,
      'Re-clicking Concepts must reset any applied concept filter');
    assert.match(src, /summaryRef\.current\?\.scrollIntoView\(\{\s*behavior:\s*'smooth',\s*block:\s*'nearest'\s*\}\)/,
      'Re-clicking Summary must smoothly scroll executive summary into view');
  });

  await t.test('5. Interactive Concept Cards & Deep Linking', () => {
    // Concept card interactive roles and keyboard handlers
    assert.match(src, /role="button"\s+tabIndex=\{0\}\s+onClick=\{\(\)\s*=>\s*setHighlightedConcept/s,
      'Concept cards must be accessible clickable buttons');
    assert.match(src, /e\.key\s*===\s*'Enter'\s*\|\|\s*e\.key\s*===\s*'\s*'/,
      'Concept cards must support keyboard toggling via Enter/Space');
    assert.match(src, /isHighlighted\s*\?\s*'border-indigo-500 bg-indigo-50\/60 shadow-md ring-2 ring-indigo-500\/30'/,
      'Highlighted concept card must visually emphasize selection');

    // Matching flashcard deep link
    assert.match(src, /matchingFlashcardIdx\s*!==\s*-1/, 'Must determine matching flashcard');
    assert.match(src, /setActiveCardIndex\(matchingFlashcardIdx\)/, 'Deep link must set active card index');
    assert.match(src, /handleTabChange\('flashcards'\)/, 'Deep link must switch to flashcards tab');

    // Source reader highlighting with badge
    assert.match(src, /Referenced Concept &bull;\s*\{highlightedConcept\}/,
      'Source reader must render badge when paragraph matches highlighted concept');
  });

  await t.test('6. Live Docker Service Health & E2E Route Validation', async () => {
    // Verify frontend container is serving 200 OK
    const frontendRes = await fetch('http://localhost:3003/');
    assert.equal(frontendRes.status, 200, 'Frontend container must return HTTP 200 OK');

    // Verify backend health endpoint is healthy
    const backendRes = await fetch('http://localhost:8003/api/health');
    assert.equal(backendRes.status, 200, 'Backend container must return HTTP 200 OK');
    const health = await backendRes.json();
    assert.equal(health.status, 'healthy', 'Backend must report status healthy');
    assert.equal(health.oxigraph_store_active, true, 'Oxigraph store must be active');

    // Verify full pipeline via frontend proxy POST /api/process
    const processRes = await fetch('http://localhost:3003/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Semantica provides deterministic knowledge graphs and provenance tracking for AI generated flashcards.'
      })
    });
    assert.equal(processRes.status, 200, 'POST /api/process must return 200 OK');
    const payload = await processRes.json();
    assert.ok(payload.flashcards.length > 0, 'Must produce flashcards');
    assert.ok(payload.concepts.length > 0, 'Must produce concepts');
  });
});
