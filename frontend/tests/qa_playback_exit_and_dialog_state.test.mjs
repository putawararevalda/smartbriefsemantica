import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('Playback Exit Navigation & Question Dialog State Preservation Verification', async (t) => {
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  const qaFile = path.join(frontendDir, 'src/components/KnowledgeGraphQA.tsx');
  const explorerFile = path.join(frontendDir, 'src/components/KnowledgeGraphExplorer.tsx');

  assert.ok(fs.existsSync(dualPaneFile), 'DualPaneWorkspace.tsx must exist');
  assert.ok(fs.existsSync(qaFile), 'KnowledgeGraphQA.tsx must exist');
  assert.ok(fs.existsSync(explorerFile), 'KnowledgeGraphExplorer.tsx must exist');

  const dualPaneSrc = fs.readFileSync(dualPaneFile, 'utf8');
  const qaSrc = fs.readFileSync(qaFile, 'utf8');
  const explorerSrc = fs.readFileSync(explorerFile, 'utf8');

  await t.test('1. Return Navigation to Q&A Dialog on Exit Playback', () => {
    // KnowledgeGraphExplorer Exit Playback button invokes onClearTraversalLineage
    assert.match(
      explorerSrc,
      /Exit Playback/,
      'KnowledgeGraphExplorer must have Exit Playback button'
    );
    assert.match(
      explorerSrc,
      /onClearTraversalLineage\(\)/,
      'Exit Playback click must invoke onClearTraversalLineage'
    );

    // DualPaneWorkspace onClearTraversalLineage switches tab back to qa
    assert.match(
      dualPaneSrc,
      /onClearTraversalLineage=\{\(\)\s*=>\s*\{[\s\S]*?setActiveTraversalLineage\(null\);[\s\S]*?(?:handleTabChange\('qa'\)|setActiveTab\('qa'\));[\s\S]*?\}\}/,
      'DualPaneWorkspace onClearTraversalLineage must reset activeTraversalLineage and navigate back to "qa" tab'
    );
  });

  await t.test('2. Question Stream & Conversation State Preserved Across Tab Switching', () => {
    // Tabpanel QA must NOT be conditionally unmounted with {activeTab === 'qa' && (
    assert.doesNotMatch(
      dualPaneSrc,
      /\{activeTab === 'qa'\s*&&\s*\(\s*<div[^>]*id="tabpanel-qa"/,
      'DualPaneWorkspace must not conditionally unmount tabpanel-qa to preserve conversation history'
    );

    // Tabpanel QA must be conditionally shown using hidden / display CSS
    assert.match(
      dualPaneSrc,
      /id="tabpanel-qa"[\s\S]*?activeTab === 'qa' \? '' : 'hidden'/,
      'tabpanel-qa must use CSS hidden toggle based on activeTab === "qa"'
    );
    assert.match(
      dualPaneSrc,
      /style=\{\{\s*display:\s*activeTab === 'qa' \? 'block' : 'none'\s*\}\}/,
      'tabpanel-qa must toggle display: block / none based on activeTab === "qa"'
    );

    // KnowledgeGraphQA must receive isVisible prop
    assert.match(
      dualPaneSrc,
      /<KnowledgeGraphQA[\s\S]*?isVisible=\{activeTab === 'qa'\}/,
      'KnowledgeGraphQA must receive isVisible prop indicating tab visibility'
    );
  });

  await t.test('3. Auto-Scroll to Last Question on Return', () => {
    assert.match(
      qaSrc,
      /isVisible\?:\s*boolean/,
      'KnowledgeGraphQAProps must accept optional isVisible prop'
    );
    assert.match(
      qaSrc,
      /if\s*\(isVisible\)\s*\{\s*messagesEndRef\.current\?\.scrollIntoView/,
      'KnowledgeGraphQA must scroll to bottom of chat when isVisible is true'
    );
  });
});
