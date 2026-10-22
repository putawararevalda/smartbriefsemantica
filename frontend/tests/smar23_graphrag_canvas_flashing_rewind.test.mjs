import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('SMAR-23: Knowledge Graph Traversal Canvas Flashing and Rewind Playback Verification', async (t) => {
  const explorerFile = path.join(frontendDir, 'src/components/KnowledgeGraphExplorer.tsx');
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  const qaFile = path.join(frontendDir, 'src/components/KnowledgeGraphQA.tsx');
  const drawerFile = path.join(frontendDir, 'src/components/SubgraphEvidenceDrawer.tsx');
  const typesFile = path.join(frontendDir, 'src/types/index.ts');
  const cssFile = path.join(frontendDir, 'src/app/globals.css');

  assert.ok(fs.existsSync(explorerFile), 'KnowledgeGraphExplorer.tsx must exist');
  assert.ok(fs.existsSync(dualPaneFile), 'DualPaneWorkspace.tsx must exist');
  assert.ok(fs.existsSync(qaFile), 'KnowledgeGraphQA.tsx must exist');
  assert.ok(fs.existsSync(drawerFile), 'SubgraphEvidenceDrawer.tsx must exist');
  assert.ok(fs.existsSync(typesFile), 'types/index.ts must exist');
  assert.ok(fs.existsSync(cssFile), 'globals.css must exist');

  const explorerSrc = fs.readFileSync(explorerFile, 'utf8');
  const dualPaneSrc = fs.readFileSync(dualPaneFile, 'utf8');
  const qaSrc = fs.readFileSync(qaFile, 'utf8');
  const drawerSrc = fs.readFileSync(drawerFile, 'utf8');
  const typesSrc = fs.readFileSync(typesFile, 'utf8');
  const cssSrc = fs.readFileSync(cssFile, 'utf8');

  await t.test('1. TypeScript Interface & Traversal Lineage Definition', () => {
    assert.match(
      typesSrc,
      /export interface TraversalLineage/,
      'types/index.ts must define TraversalLineage interface'
    );
    assert.match(
      typesSrc,
      /graphContext\?: GraphContext/,
      'TraversalLineage must define graphContext'
    );
    assert.match(
      explorerSrc,
      /activeTraversalLineage\?: TraversalLineage \| null/,
      'KnowledgeGraphExplorerProps must accept activeTraversalLineage'
    );
    assert.match(
      explorerSrc,
      /onClearTraversalLineage\?: \(\) => void/,
      'KnowledgeGraphExplorerProps must accept onClearTraversalLineage'
    );
  });

  await t.test('2. Canvas Node & Edge Flash / Pulse Highlighting Architecture', () => {
    // Accessible SVG glow drop-shadow filters
    assert.match(
      explorerSrc,
      /filter id="glow-anchor"/,
      'KnowledgeGraphExplorer SVG defs must declare glow-anchor filter'
    );
    assert.match(
      explorerSrc,
      /filter id="glow-1hop"/,
      'KnowledgeGraphExplorer SVG defs must declare glow-1hop filter'
    );
    assert.match(
      explorerSrc,
      /filter id="glow-2hop"/,
      'KnowledgeGraphExplorer SVG defs must declare glow-2hop filter'
    );

    // Dynamic directional arrowheads
    assert.match(
      explorerSrc,
      /id="arrowhead-1hop"/,
      'KnowledgeGraphExplorer SVG defs must declare arrowhead-1hop'
    );
    assert.match(
      explorerSrc,
      /id="arrowhead-2hop"/,
      'KnowledgeGraphExplorer SVG defs must declare arrowhead-2hop'
    );

    // Color mapping & pulse for traversal steps:
    // Concept Grounding (Anchor): Amber/Gold glow and halo ring
    assert.match(
      explorerSrc,
      /#f59e0b|#b45309|#fbbf24/,
      'Concept Grounding (Anchor) must utilize amber/gold color highlights'
    );
    // 1-Hop Traversal: Indigo/Cyan glow and pulse
    assert.match(
      explorerSrc,
      /#06b6d4|#0e7490|#38bdf8/,
      '1-Hop Traversal must utilize indigo/cyan color highlights'
    );
    // 2-Hop Traversal: Purple/Emerald glow and pulse
    assert.match(
      explorerSrc,
      /#a855f7|#6d28d9|#c084fc/,
      '2-Hop Traversal must utilize purple/emerald color highlights'
    );

    // Accessible gentle decay pulse animations
    assert.match(
      explorerSrc,
      /animate-pulse/,
      'Active hop nodes and edges must apply animate-pulse'
    );
    assert.match(
      cssSrc,
      /gentlePulse|haloPulse/,
      'globals.css must define accessible gentle pulse keyframes'
    );
  });

  await t.test('3. Traversal History Playback & Rewind Scrubber Bar Controls', () => {
    // Toolbar declaration
    assert.match(
      explorerSrc,
      /role="toolbar"/,
      'Playback bar must declare role="toolbar" for WCAG accessibility'
    );
    assert.match(
      explorerSrc,
      /aria-label="Knowledge Graph Traversal Playback Controls"/,
      'Playback bar must declare accessible aria-label'
    );

    // 5 Required Playback Toolbar Buttons
    // [⏮ Rewind to Start]
    assert.match(
      explorerSrc,
      /aria-label="Rewind to Start"/,
      'Toolbar must implement [⏮ Rewind to Start] button'
    );
    assert.match(
      explorerSrc,
      /⏮/,
      'Rewind button must display rewind symbol'
    );

    // [◀ Step Back]
    assert.match(
      explorerSrc,
      /aria-label="Step Back"/,
      'Toolbar must implement [◀ Step Back] button'
    );
    assert.match(
      explorerSrc,
      /◀/,
      'Step Back button must display step-back symbol'
    );

    // [▶ Play / ⏸ Pause]
    assert.match(
      explorerSrc,
      /aria-label=\{isPlaying \? 'Pause Traversal' : 'Play Traversal'\}/,
      'Toolbar must implement dynamic [▶ Play / ⏸ Pause] button'
    );

    // [Step Forward ▶]
    assert.match(
      explorerSrc,
      /aria-label="Step Forward"/,
      'Toolbar must implement [Step Forward ▶] button'
    );
    assert.match(
      explorerSrc,
      /▶/,
      'Step Forward button must display step-forward symbol'
    );

    // [⏭ Fast Forward to Full Subgraph]
    assert.match(
      explorerSrc,
      /aria-label="Fast Forward to Full Subgraph"/,
      'Toolbar must implement [⏭ Fast Forward to Full Subgraph] button'
    );
    assert.match(
      explorerSrc,
      /⏭/,
      'Fast Forward button must display fast-forward symbol'
    );

    // Automated sequential cadence of ~800ms
    assert.match(
      explorerSrc,
      /setInterval\([\s\S]*?800\)/,
      'Automated sequential playback must run with ~800ms cadence between hops'
    );

    // Hop index indicator
    assert.match(
      explorerSrc,
      /Hop \{currentHop\} of \{maxHops\} \(\{currentHopDef\.title\}\)/,
      'Toolbar must render dynamic hop index indicator'
    );
    assert.match(
      explorerSrc,
      /Concept Grounding/,
      'Hop 0 definition must be Concept Grounding'
    );
    assert.match(
      explorerSrc,
      /1-Hop SPARQL/,
      'Hop 1 definition must be 1-Hop SPARQL'
    );
    assert.match(
      explorerSrc,
      /Evidence Subgraph/,
      'Hop 2 definition must be Evidence Subgraph'
    );

    // Range scrubber
    assert.match(
      explorerSrc,
      /<input[^>]*type="range"[^>]*aria-label="Hop Scrubber"/,
      'Toolbar must render range scrubber with accessible aria-label'
    );
  });

  await t.test('4. State Rewind Mechanics & Subgraph Filtering', () => {
    // nodeHopLevels and edgeHopLevels computation
    assert.match(
      explorerSrc,
      /nodeHopLevels/,
      'KnowledgeGraphExplorer must compute nodeHopLevels dictionary'
    );
    assert.match(
      explorerSrc,
      /edgeHopLevels/,
      'KnowledgeGraphExplorer must compute edgeHopLevels dictionary'
    );

    // Subgraph state rewind: subsequent hops and unvisited branches dimmed
    assert.match(
      explorerSrc,
      /isDiscovered = edgeHop !== -1 && edgeHop <= currentHop/,
      'Edge visibility must be strictly bound to currentHop state rewind'
    );
    assert.match(
      explorerSrc,
      /isDiscovered = nodeHop !== -1 && nodeHop <= currentHop/,
      'Node visibility must be strictly bound to currentHop state rewind'
    );
    assert.match(
      explorerSrc,
      /opacity=\{isUnvisited \? 0\.12 : 1\}/,
      'Unvisited and subsequent nodes must be dynamically dimmed during rewind'
    );
  });

  await t.test('5. Inter-Pane & Q&A Synchronization Integration', () => {
    // Q&A dispatch on query complete and inspect traversal on breadcrumb
    assert.match(
      qaSrc,
      /onDispatchTraversal\?:/,
      'KnowledgeGraphQA must accept onDispatchTraversal callback'
    );
    assert.match(
      qaSrc,
      /onInspectTraversalOnCanvas\?:/,
      'KnowledgeGraphQA must accept onInspectTraversalOnCanvas callback'
    );
    assert.match(
      qaSrc,
      /aria-label="Replay Traversal on Knowledge Graph Canvas"/,
      'KnowledgeGraphQA breadcrumb must offer Replay Traversal on Canvas action'
    );

    // Drawer "Replay on Canvas" action
    assert.match(
      drawerSrc,
      /onReplayOnCanvas\?:/,
      'SubgraphEvidenceDrawer must accept onReplayOnCanvas prop'
    );
    assert.match(
      drawerSrc,
      /Replay on Canvas/,
      'SubgraphEvidenceDrawer header must render Replay on Canvas action button'
    );

    // DualPaneWorkspace coordination
    assert.match(
      dualPaneSrc,
      /activeTraversalLineage/,
      'DualPaneWorkspace must maintain activeTraversalLineage state'
    );
    assert.match(
      dualPaneSrc,
      /handleInspectTraversalOnCanvas/,
      'DualPaneWorkspace must handle traversal inspection and auto-switch to graph tab'
    );
    assert.match(
      dualPaneSrc,
      /<KnowledgeGraphExplorer[^>]*activeTraversalLineage=\{activeTraversalLineage\}/,
      'DualPaneWorkspace must wire activeTraversalLineage to KnowledgeGraphExplorer'
    );
    assert.match(
      dualPaneSrc,
      /<KnowledgeGraphQA[^>]*onInspectTraversalOnCanvas=\{handleInspectTraversalOnCanvas\}/,
      'DualPaneWorkspace must wire onInspectTraversalOnCanvas to KnowledgeGraphQA'
    );
  });

  await t.test('6. Accessibility (WCAG 2.1 AA) & Motion Reduction Compliance', () => {
    // Motion reduction classes
    assert.match(
      explorerSrc,
      /motion-reduce:animate-none/,
      'KnowledgeGraphExplorer must strictly disable animations under prefers-reduced-motion'
    );
    assert.match(
      explorerSrc,
      /motion-reduce:transition-none/,
      'KnowledgeGraphExplorer must disable transitions under prefers-reduced-motion'
    );
    assert.match(
      cssSrc,
      /@media \(prefers-reduced-motion: reduce\)/,
      'globals.css must include prefers-reduced-motion media query override'
    );

    // Keyboard navigation handlers
    assert.match(
      explorerSrc,
      /e\.key === 'ArrowLeft'/,
      'Component must support ArrowLeft keyboard step navigation'
    );
    assert.match(
      explorerSrc,
      /e\.key === 'ArrowRight'/,
      'Component must support ArrowRight keyboard step navigation'
    );
    assert.match(
      explorerSrc,
      /e\.key === ' ' \|\| e\.code === 'Space'/,
      'Component must support Space key playback toggling'
    );
  });
});
