import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('Sprint 2: Dual-Pane Workspace & Interactive Active Recall Study Deck', async (t) => {
  const dualPanePath = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  const flashcardDeckPath = path.join(frontendDir, 'src/components/FlashcardDeck.tsx');
  const globalsCssPath = path.join(frontendDir, 'src/app/globals.css');
  const pagePath = path.join(frontendDir, 'src/app/page.tsx');

  await t.test('All Sprint 2 component and style files exist', () => {
    assert.ok(fs.existsSync(dualPanePath), 'DualPaneWorkspace.tsx must exist');
    assert.ok(fs.existsSync(flashcardDeckPath), 'FlashcardDeck.tsx must exist');
    assert.ok(fs.existsSync(globalsCssPath), 'globals.css must exist');
    assert.ok(fs.existsSync(pagePath), 'page.tsx must exist');
  });

  await t.test('globals.css includes 3D perspective and card transform utilities', () => {
    const cssContent = fs.readFileSync(globalsCssPath, 'utf-8');
    assert.match(cssContent, /perspective-1000/i, 'Must define perspective-1000 utility');
    assert.match(cssContent, /transform-style-3d|preserve-3d/i, 'Must define 3D transform-style utility');
    assert.match(cssContent, /backface-hidden|backface-visibility/i, 'Must define backface-visibility hidden utility');
    assert.match(cssContent, /rotate-y-180|rotateY\(180deg\)/i, 'Must define 180deg Y-axis rotation utility');
  });

  await t.test('DualPaneWorkspace implements Synchronized Source Reader (Left Pane)', () => {
    const content = fs.readFileSync(dualPanePath, 'utf-8');

    // Sticky header with document title, word count, and New Article reset
    assert.match(content, /documentTitle|Source Document/i, 'Must render document title in header');
    assert.match(content, /wordCount/i, 'Must display word count badge');
    assert.match(content, /onNewArticle|New Article/i, 'Must provide New Article reset action');

    // Semantic highlighting anchor support (provenance citation linking)
    assert.match(content, /isParagraphProvenanceAnchor|source_excerpt|source_text|Active Citation Anchor/i,
      'Must implement semantic highlighting anchor for provenance excerpt');

    // Conditional citation anchor highlighting and badge based on Study Deck Mode (SMAR-21)
    assert.match(content, /isAnchor\s*=\s*showFlashcards\s*&&\s*isParagraphProvenanceAnchor/i,
      'Citation anchor matching must be conditioned on Study Deck Mode (showFlashcards)');
    assert.match(content, /!showFlashcards\s*\|\|\s*activeTab\s*!==\s*'flashcards'/i,
      'Auto-scroll to active citation anchor must only run when Study Deck Mode is active and viewing flashcards');

    // Independent smooth scrolling and typography
    assert.match(content, /overflow-y-auto/i, 'Left pane must have independent scrolling');
    assert.match(content, /scroll-smooth/i, 'Left pane must support smooth scrolling');
    assert.match(content, /font-sans|leading-relaxed/i, 'Must format text with readable typography');
  });

  await t.test('DualPaneWorkspace implements Tabbed Synthesis Hub (Right Pane)', () => {
    const content = fs.readFileSync(dualPanePath, 'utf-8');

    // 3 Tabs: Flashcards, Executive Summary, Concept Matrix
    assert.match(content, /flashcards/i, 'Must include Flashcards tab');
    assert.match(content, /summary/i, 'Must include Executive Summary tab');
    assert.match(content, /concepts/i, 'Must include Concept Matrix tab');

    // Embeds FlashcardDeck
    assert.match(content, /<FlashcardDeck/i, 'Must embed FlashcardDeck component in right pane');

    // Structured Executive Summary with Copy action
    assert.match(content, /Copy Markdown|handleCopySummary|copiedSummary/i,
      'Executive Summary must offer Copy Markdown action');
    assert.match(content, /Key Takeaways/i, 'Must extract structured key takeaways');

    // Interactive Concept Matrix
    assert.match(content, /Oxigraph|conceptFilter|filteredConcepts/i,
      'Concept Matrix must support filtering and Oxigraph triples inspection');
  });

  await t.test('DualPaneWorkspace implements Responsive Ergonomics (50/50 Desktop vs Tabbed Mobile)', () => {
    const content = fs.readFileSync(dualPanePath, 'utf-8');

    // Desktop 50/50 split (grid-cols-1 lg:grid-cols-2)
    assert.match(content, /lg:grid-cols-2/i, 'Must specify 50/50 dual pane grid for desktop (>=1024px)');

    // Mobile / Tablet toggle (< 1024px)
    assert.match(content, /mobileView|setMobileView/i, 'Must implement mobile view toggle state');
    assert.match(content, /lg:hidden/i, 'Must render mobile segment switcher on smaller viewports');
  });

  await t.test('FlashcardDeck implements True 3D Flip Card Interaction', () => {
    const content = fs.readFileSync(flashcardDeckPath, 'utf-8');

    // 3D Flip mechanics
    assert.match(content, /preserve-3d/i, 'Must use preserve-3d style for card flip');
    assert.match(content, /rotateY\(180deg\)|rotate-y-180/i, 'Must rotate back face 180 degrees');
    assert.match(content, /backfaceVisibility|backface-hidden/i, 'Must hide backface on faces');

    // Front Face specifications
    assert.match(content, /Card \$\{currentIndex \+ 1\} of \$\{totalCards\}|Card \{currentIndex \+ 1\}/i,
      'Front face must display card position indicator');
    assert.match(content, /Click.*Space.*Reveal Answer|Click.*Space.*flip/i,
      'Front face must prompt to flip via click or space');
    assert.match(content, /deck-trace-source-front|onTraceSource/i,
      'Front face must provide Trace Source action');

    // Back Face specifications
    assert.match(content, /Synthesized Answer|Answer & Retention/i, 'Back face must show answer');
    assert.match(content, /Rate your recall|SuperMemo/i, 'Back face must present SuperMemo rating scale');
    assert.match(content, /deck-trace-source-back|onTraceSource/i,
      'Back face must provide Trace Source action');
  });

  await t.test('FlashcardDeck implements SuperMemo Scale & Session Mastery Statistics', () => {
    const content = fs.readFileSync(flashcardDeckPath, 'utf-8');

    // 4 SuperMemo self-rating buttons
    assert.match(content, /Again/i, 'Must include "Again" rating button');
    assert.match(content, /Hard/i, 'Must include "Hard" rating button');
    assert.match(content, /Good/i, 'Must include "Good" rating button');
    assert.match(content, /Easy/i, 'Must include "Easy" rating button');

    // Interval cues (< 1 min, 10 min, 1 day, 3 days)
    assert.match(content, /< 1 min/i, 'Again must show < 1 min interval');
    assert.match(content, /10 min/i, 'Hard must show 10 min interval');
    assert.match(content, /1 day/i, 'Good must show 1 day interval');
    assert.match(content, /3 days/i, 'Easy must show 3 days interval');

    // Session Statistics
    assert.match(content, /reviewedCount|cards reviewed/i, 'Must compute reviewed card count');
    assert.match(content, /masteredCount|Mastered/i, 'Must compute mastered count');
    assert.match(content, /remainingCount|Queue/i, 'Must compute remaining queue');
    assert.match(content, /progressPercent|progressbar/i, 'Must render deck completion progress bar');
  });

  await t.test('FlashcardDeck implements Full Keyboard Navigation & WCAG 2.1 AA Accessibility', () => {
    const content = fs.readFileSync(flashcardDeckPath, 'utf-8');

    // Keyboard Shortcuts
    assert.match(content, /e\.key === ' ' \|\| e\.key === 'Enter'/i, 'Space or Enter must flip card');
    assert.match(content, /ArrowRight.*'j'.*'J'/i, 'ArrowRight or J must navigate to next card');
    assert.match(content, /ArrowLeft.*'k'.*'K'/i, 'ArrowLeft or K must navigate to previous card');
    assert.match(content, /e\.key === '1'/i, 'Key 1 must grade as Again');
    assert.match(content, /e\.key === '2'/i, 'Key 2 must grade as Hard');
    assert.match(content, /e\.key === '3'/i, 'Key 3 must grade as Good');
    assert.match(content, /e\.key === '4'/i, 'Key 4 must grade as Easy');

    // Accessibility: aria-live polite announcements
    assert.match(content, /aria-live=["']polite["']/, 'Must include aria-live="polite" for screen readers');
    assert.match(content, /aria-label=/i, 'Must provide descriptive aria-labels on controls');
    assert.match(content, /tabIndex=\{0\}/i, 'Card must be focusable via keyboard tabIndex');
  });

  await t.test('Edge Cases: 1-Card Deck, Text Overflow, and Focus Retention', () => {
    const content = fs.readFileSync(flashcardDeckPath, 'utf-8');

    // 1-card deck: cleanly disabled buttons
    assert.match(content, /disabled=\{currentIndex === 0\}/, 'Previous button must be cleanly disabled at first card');
    assert.match(content, /disabled=\{currentIndex === totalCards - 1\}/, 'Next button must be cleanly disabled at last card');

    // Text overflow: internal scrolling container
    assert.match(content, /overflow-y-auto/i, 'Faces must scroll internally for long text/code without breaking 3D transform');
  });

  await t.test('SMAR-21: Citation Anchor Badge and Highlight Suppressed when Study Deck Mode is OFF', () => {
    const content = fs.readFileSync(dualPanePath, 'utf-8');

    // Condition isAnchor on showFlashcards
    assert.match(content, /const\s+isAnchor\s*=\s*showFlashcards\s*&&\s*isParagraphProvenanceAnchor\(para\)/,
      'isAnchor must be conditioned on showFlashcards being true');

    // Active Citation Anchor badge conditioned on isAnchor
    assert.match(content, /\{isAnchor\s*&&\s*\(\s*<div[^>]*>[\s\S]*?Active Citation Anchor\s*&bull;\s*Card \{activeCardIndex \+ 1\}<\/span>/,
      'Active Citation Anchor badge must be conditionally rendered only when isAnchor is true');

    // Provenance border and background highlight conditioned on isAnchor
    assert.match(content, /isAnchor\s*\?\s*['"]bg-indigo-50\/90 border-l-4 border-indigo-600 shadow-xs ring-1 ring-indigo-200\/70['"]/,
      'Citation anchor highlight (bg-indigo-50/90 border-l-4 border-indigo-600) must only be applied when isAnchor is true');

    // Auto-scrolling left pane guarded by showFlashcards and activeTab === 'flashcards'
    assert.match(content, /if\s*\(!showFlashcards\s*\|\|\s*activeTab\s*!==\s*'flashcards'\)\s*return;/,
      'Auto-scroll left pane to active provenance anchor must only run when showFlashcards && activeTab === "flashcards"');

    // Concept match and search highlighting remain functional
    assert.match(content, /!isAnchor\s*&&\s*isConceptMatch/,
      'Concept match badge must continue to function independently when citation anchor is not active');
  });

  await t.test('Home page integrates DualPaneWorkspace without below-the-fold scroll', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');

    // DualPaneWorkspace integration
    assert.match(content, /<DualPaneWorkspace/i, 'Home page must render DualPaneWorkspace on results');
    assert.match(content, /sourceText=\{text\}/i, 'Must pass original sourceText to DualPaneWorkspace');
    assert.match(content, /onNewArticle=/i, 'Must provide onNewArticle callback to reset results');
    assert.match(content, /!result &&/i, 'Must hide ingestion hub and banner when displaying workspace results');
  });
});
