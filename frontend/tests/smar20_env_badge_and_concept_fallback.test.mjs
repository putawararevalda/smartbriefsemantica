import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendDir, '..');

test('SMAR-20: Persistent OPENAI_API_KEY Loading, AI Engine Status Badge & Concept Extraction Fallback', async (t) => {
  const dualPaneFile = path.join(frontendDir, 'src/components/DualPaneWorkspace.tsx');
  const dockerComposeFile = path.join(repoRoot, 'docker-compose.yml');
  const backendMainFile = path.join(repoRoot, 'backend/main.py');

  assert.ok(fs.existsSync(dualPaneFile), 'DualPaneWorkspace.tsx must exist');
  assert.ok(fs.existsSync(dockerComposeFile), 'docker-compose.yml must exist');
  assert.ok(fs.existsSync(backendMainFile), 'backend/main.py must exist');

  const dualPaneSrc = fs.readFileSync(dualPaneFile, 'utf8');
  const dockerComposeSrc = fs.readFileSync(dockerComposeFile, 'utf8');
  const backendSrc = fs.readFileSync(backendMainFile, 'utf8');

  await t.test('1. Persistent .env Loading Across Task Workdirs in docker-compose.yml and backend/main.py', () => {
    assert.match(
      dockerComposeSrc,
      /\/root\/multica_workspaces\/smartbriefm-deb1926d499b\/\.env/,
      'docker-compose.yml must reference shared workspace .env file'
    );
    assert.match(
      backendSrc,
      /\/app\/\.env\.shared/,
      '_load_env_file in backend/main.py must check /app/.env.shared'
    );
    assert.match(
      backendSrc,
      /\/root\/multica_workspaces\/smartbriefm-deb1926d499b\/\.env/,
      '_load_env_file in backend/main.py must check /root/multica_workspaces/smartbriefm-deb1926d499b/.env'
    );
  });

  await t.test('2. Visible AI Engine Status Badge in DualPaneWorkspace.tsx', () => {
    assert.match(
      dualPaneSrc,
      /isOpenAIEngine/,
      'DualPaneWorkspace.tsx must compute isOpenAIEngine from provenance_summary.storage_backend or flashcards[0].provenance.agent'
    );
    assert.match(
      dualPaneSrc,
      /OpenAI GPT-4o-mini/,
      'DualPaneWorkspace.tsx must render "OpenAI GPT-4o-mini" badge when OpenAI is active'
    );
    assert.match(
      dualPaneSrc,
      /Local Heuristic Fallback/,
      'DualPaneWorkspace.tsx must render "Local Heuristic Fallback" badge when local fallback is used'
    );
    assert.match(
      dualPaneSrc,
      /bg-amber-50[\s\S]*?border-amber-200/,
      'Local Heuristic Fallback badge must use amber styling'
    );
  });

  await t.test('3. Backend Local Heuristic Concept Extraction Fallback Enhancements', () => {
    assert.match(backendSrc, /"name":\s*"Environmental Economics"/, 'CANDIDATE_CONCEPTS must include Environmental Economics');
    assert.match(backendSrc, /"name":\s*"Carbon Pricing"/, 'CANDIDATE_CONCEPTS must include Carbon Pricing');
    assert.match(backendSrc, /"name":\s*"Market Externalities"/, 'CANDIDATE_CONCEPTS must include Market Externalities');
    assert.match(backendSrc, /"name":\s*"Circular Economy"/, 'CANDIDATE_CONCEPTS must include Circular Economy');
    assert.match(backendSrc, /"name":\s*"Quantum Superposition & Entanglement"/, 'CANDIDATE_CONCEPTS must include Quantum Superposition & Entanglement');
    assert.match(backendSrc, /"name":\s*"Topological Surface Codes"/, 'CANDIDATE_CONCEPTS must include Topological Surface Codes');
    assert.match(backendSrc, /"name":\s*"Superconducting Transmon Qubits"/, 'CANDIDATE_CONCEPTS must include Superconducting Transmon Qubits');
    assert.match(backendSrc, /standalone_modifiers/, '_extract_key_concepts must guard against standalone sentence-initial modifiers');
  });

  await t.test('4. Live Docker Verification: Health openai_available=true & Environmental Economics Multi-Word Extraction', async () => {
    const backendBase = process.env.TEST_BACKEND_URL || 'http://localhost:8003';

    // 4.1 Verify /api/health reports openai_available: true
    const healthRes = await fetch(`${backendBase}/api/health`);
    assert.equal(healthRes.status, 200, 'GET /api/health must return HTTP 200');
    const healthData = await healthRes.json();
    assert.equal(healthData.openai_available, true, 'GET /api/health must report openai_available: true');

    // 4.2 Verify POST /api/process with Environmental Economics sample
    const envSample =
      'Environmental economics examines the intricate interplay between global economic activity, market incentives, and planetary ecological boundaries. ' +
      'Traditional neoclassical models often treat environmental degradation as an externalized market failure, failing to account for the finite carrying capacity of natural ecosystems and biodiversity depletion.\n\n' +
      'Modern carbon pricing mechanisms, including cap-and-trade allowances and border carbon adjustments, aim to internalize greenhouse gas emissions costs across industrial supply chains. ' +
      'Furthermore, circular economy frameworks transition modern production models away from linear extract-produce-dispose cycles toward closed-loop material recovery, renewable energy deployment, and natural capital accounting to achieve sustainable macroeconomic resilience.';

    const procRes = await fetch(`${backendBase}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: envSample, session_id: 'proc_smar20_live_env' }),
    });
    assert.equal(procRes.status, 200, 'POST /api/process must return HTTP 200');
    const procData = await procRes.json();

    assert.match(
      procData.provenance_summary?.storage_backend || '',
      /OpenAI gpt-4o-mini/i,
      'provenance_summary.storage_backend must indicate OpenAI gpt-4o-mini'
    );

    const conceptNames = (procData.concepts || []).map((c) => c.name);
    assert.ok(conceptNames.length >= 3, 'Must extract at least 3 domain concepts');
    assert.ok(!conceptNames.includes('Environmental'), 'Must not extract standalone word "Environmental"');
    assert.ok(!conceptNames.includes('Traditional'), 'Must not extract standalone word "Traditional"');
    assert.ok(!conceptNames.includes('Modern'), 'Must not extract standalone word "Modern"');
    assert.ok(
      conceptNames.some((n) => /environmental economics|carbon pricing|circular economy|cap-and-trade|market externalities/i.test(n)),
      `Expected meaningful domain concepts, got: ${conceptNames.join(', ')}`
    );
  });
});
