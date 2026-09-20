import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('Sprint 1: Multi-Modal Ingestion Hub & Progressive Stepper Implementation', async (t) => {
  const ingestionHubPath = path.join(frontendDir, 'src/components/IngestionHub.tsx');
  const progressStepperPath = path.join(frontendDir, 'src/components/ProgressStepper.tsx');
  const errorAlertPath = path.join(frontendDir, 'src/components/ErrorAlert.tsx');
  const sampleDataPath = path.join(frontendDir, 'src/lib/sampleData.ts');
  const pagePath = path.join(frontendDir, 'src/app/page.tsx');

  await t.test('All Sprint 1 component files exist', () => {
    assert.ok(fs.existsSync(ingestionHubPath), 'IngestionHub.tsx must exist');
    assert.ok(fs.existsSync(progressStepperPath), 'ProgressStepper.tsx must exist');
    assert.ok(fs.existsSync(errorAlertPath), 'ErrorAlert.tsx must exist');
    assert.ok(fs.existsSync(sampleDataPath), 'sampleData.ts must exist');
    assert.ok(fs.existsSync(pagePath), 'page.tsx must exist');
  });

  await t.test('Curated Sample Library provides at least 3 distinct domains', () => {
    const sampleDataContent = fs.readFileSync(sampleDataPath, 'utf-8');

    // Verify 3 distinct domains in sampleData
    assert.match(sampleDataContent, /['"]Neuro-Symbolic AI['"]/i, 'Must include Neuro-Symbolic AI domain');
    assert.match(sampleDataContent, /['"]Quantum Computing['"]/i, 'Must include Quantum Computing domain');
    assert.match(sampleDataContent, /['"]Environmental Economics['"]/i, 'Must include Environmental Economics domain');

    // Verify mock responses exist with summary and flashcards
    assert.match(sampleDataContent, /getOfflineSampleResponse/, 'Must export getOfflineSampleResponse');
    assert.match(sampleDataContent, /provenance:\s*\{/, 'Curated mock responses must include provenance records');
    assert.match(sampleDataContent, /graph_nodes:\s*\[/, 'Curated mock responses must include graph nodes');
    assert.match(sampleDataContent, /Oxigraph/i, 'Curated mock responses must reference Oxigraph store');
    assert.match(sampleDataContent, /PROV-O/i, 'Curated mock responses must reference W3C PROV-O lineage');
  });

  await t.test('IngestionHub implements live counters, token estimation, and validation', () => {
    const content = fs.readFileSync(ingestionHubPath, 'utf-8');

    // Live counters
    assert.match(content, /wordCount\s*=/, 'Must compute live wordCount');
    assert.match(content, /charCount\s*=/, 'Must compute live charCount');
    assert.match(content, /estTokens\s*=/, 'Must compute token estimation');
    assert.match(content, /estSeconds|estLatency|latency/i, 'Must estimate processing time/latency');

    // Pre-flight non-blocking warnings (< 50 words)
    assert.match(content, /Text is too short for meaningful semantic knowledge extraction/i,
      'Must display subtle warning for text under 50 words');
    assert.match(content, /minimum 50 words recommended/i,
      'Must state 50 words minimum recommendation');

    // Edge case: Massive inputs (> 50,000 words)
    assert.match(content, /50000|50,000/, 'Must check for massive inputs (>50,000 words)');
    assert.match(content, /Massive document/i, 'Must warn user of extended processing time for massive documents');

    // Safety: Clear confirmation dialog
    assert.match(content, /showClearConfirm|confirmClear/i, 'Must have clear confirmation state');
    assert.match(content, /Clear Article Content\?|Are you sure/i, 'Must ask user before clearing content');
    assert.match(content, /role=["']dialog["']|aria-modal=["']true["']/i, 'Clear dialog must have accessible dialog attributes');

    // Debounce protection
    assert.match(content, /lastSubmitTimeRef|now -/i, 'Submit action must be debounced');
  });

  await t.test('ProgressStepper implements deterministic 4-stage pipeline with accessible feedback', () => {
    const content = fs.readFileSync(progressStepperPath, 'utf-8');

    // 4 Deterministic stages
    assert.match(content, /Ingesting & Tokenizing Text/i, 'Stage 1 must match specification');
    assert.match(content, /Extracting Entities & Building Oxigraph Triples/i, 'Stage 2 must match specification');
    assert.match(content, /Synthesizing Flashcards & Reasoning Chains/i, 'Stage 3 must match specification');
    assert.match(content, /Generating Cryptographic W3C PROV-O Lineage/i, 'Stage 4 must match specification');

    // Accessibility: aria-live="polite"
    assert.match(content, /aria-live=["']polite["']/, 'Must include aria-live="polite" for screen reader announcements');

    // Visual feedback: pulsing active state and completion checkmarks
    assert.match(content, /animate-pulse|animate-spin/i, 'Active step must display animated pulsing/loading indicator');
    assert.match(content, /CheckCircle2|isCompleted/i, 'Completed steps must render checkmarks');

    // Elapsed time & estimated countdown
    assert.match(content, /Elapsed:/i, 'Must render elapsed time badge');
    assert.match(content, /Est:/i, 'Must render estimated time badge');

    // In-flight cancellation
    assert.match(content, /Cancel Analysis/i, 'Must render visible "Cancel Analysis" button');
    assert.match(content, /onCancel/i, 'Must handle cancellation callback');
    assert.match(content, /lastCancelTimeRef/i, 'Cancellation button must be debounced against rapid double clicks');
  });

  await t.test('ErrorAlert categorizes errors with actionable recovery options', () => {
    const content = fs.readFileSync(errorAlertPath, 'utf-8');

    // Categorization
    assert.match(content, /network_offline/i, 'Must categorize network offline errors');
    assert.match(content, /invalid_input/i, 'Must categorize invalid input errors');
    assert.match(content, /timeout/i, 'Must categorize timeout errors');
    assert.match(content, /Unable to reach Semantica API service/i, 'Must render network offline headline');

    // Action buttons
    assert.match(content, /Retry Connection/i, 'Must provide "Retry Connection" button');
    assert.match(content, /Load Offline Sample/i, 'Must provide "Load Offline Sample" button');

    // Accessibility
    assert.match(content, /role=["']alert["']/, 'Must have role="alert"');
  });

  await t.test('Home page integrates AbortController, cancellation, and state preservation', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');

    assert.match(content, /AbortController/i, 'Must instantiate and manage AbortController');
    assert.match(content, /signal:\s*controller\.signal/i, 'Must pass signal to fetch request');
    assert.match(content, /handleCancel/i, 'Must provide handleCancel handler');
    assert.match(content, /handleRetry/i, 'Must provide retry handler');
    assert.match(content, /handleLoadOfflineSample/i, 'Must provide offline sample handler');
    assert.match(content, /ProgressStepper/i, 'Must render ProgressStepper');
    assert.match(content, /ErrorAlert/i, 'Must render ErrorAlert');
  });
});
