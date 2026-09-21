'use client';

import React, { useState, useRef } from 'react';
import Header from '@/components/Header';
import IngestionHub from '@/components/IngestionHub';
import ProgressStepper from '@/components/ProgressStepper';
import ErrorAlert, { AppError } from '@/components/ErrorAlert';
import SummaryCard from '@/components/SummaryCard';
import KnowledgeGraphCard from '@/components/KnowledgeGraphCard';
import FlashcardsGrid from '@/components/FlashcardsGrid';
import ProvenanceModal from '@/components/ProvenanceModal';
import DualPaneWorkspace from '@/components/DualPaneWorkspace';
import { ProcessResponse, Flashcard } from '@/types';
import { Sparkles } from 'lucide-react';
import { getOfflineSampleResponse, CURATED_SAMPLES } from '@/lib/sampleData';

export default function Home() {
  const [text, setText] = useState<string>('');
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>('neuro-symbolic-ai');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [selectedCardForTrace, setSelectedCardForTrace] = useState<Flashcard | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastCancelTimeRef = useRef<number>(0);
  const lastSubmitTimeRef = useRef<number>(0);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleSubmit = async (inputText: string) => {
    const textToProcess = inputText.trim();
    if (!textToProcess) return;

    // Debounce rapid submits
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 600) return;
    lastSubmitTimeRef.current = now;

    // Abort any active prior in-flight controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ text: textToProcess }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 400) {
          setError({
            category: 'invalid_input',
            message: errData.error || 'Text is invalid or too short for semantic extraction.',
            raw: `HTTP 400: ${JSON.stringify(errData)}`,
          });
        } else if (res.status === 504 || res.status === 408) {
          setError({
            category: 'timeout',
            message: 'Processing timed out while communicating with the Semantica service.',
            raw: `HTTP ${res.status}: ${JSON.stringify(errData)}`,
          });
        } else {
          setError({
            category: 'network_offline',
            message: 'Unable to reach Semantica API service',
            raw: `HTTP ${res.status}: ${JSON.stringify(errData)}`,
          });
        }
        return;
      }

      const data: ProcessResponse = await res.json();
      setResult(data);
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User triggered cancellation
        setError({
          category: 'cancelled',
          message: 'Analysis was cancelled. Your text remains preserved in the input hub.',
        });
      } else {
        console.error('Submission error:', err);
        const isNetworkErr =
          err.message?.includes('fetch') ||
          err.message?.includes('network') ||
          err.message?.includes('Failed') ||
          err.name === 'TypeError';

        setError({
          category: isNetworkErr ? 'network_offline' : 'generic',
          message: isNetworkErr
            ? 'Unable to reach Semantica API service'
            : err.message || 'An unexpected error occurred.',
          raw: err.stack || err.message,
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    const now = Date.now();
    if (now - lastCancelTimeRef.current < 500) return;
    lastCancelTimeRef.current = now;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
  };

  const handleRetry = () => {
    if (text.trim()) {
      handleSubmit(text);
    }
  };

  const handleLoadOfflineSample = () => {
    const offlineData = getOfflineSampleResponse(selectedSampleId || undefined);
    if (!text.trim()) {
      const sample = CURATED_SAMPLES.find((s) => s.id === selectedSampleId) || CURATED_SAMPLES[0];
      setText(sample.content);
    }
    setResult(offlineData);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Welcome / Hero Banner - Shown when not viewing active results */}
        {!result && (
          <section className="text-center max-w-3xl mx-auto pt-2 pb-2 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100/80 text-blue-800 border border-blue-200 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>FastAPI + Oxigraph Triplestore + W3C PROV-O</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Synthesize Knowledge with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                Verifiable Provenance
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Extract articles into structured RDF knowledge graphs and interactive Q&A flashcards. Every generated answer is anchored to an immutable Oxigraph node and verifiable audit trail.
            </p>
          </section>
        )}

        {/* Phase 1: Multi-Modal Ingestion Hub (active when results are not shown) */}
        {!result && (
          <IngestionHub
            text={text}
            setText={setText}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            selectedSampleId={selectedSampleId}
            onSelectSampleId={setSelectedSampleId}
          />
        )}

        {/* Phase 2: Deterministic 4-Stage Progressive Status Stepper */}
        {isLoading && (
          <ProgressStepper
            isLoading={isLoading}
            onCancel={handleCancel}
            wordCount={wordCount}
          />
        )}

        {/* Actionable Error Recovery Alert */}
        {error && (
          <ErrorAlert
            error={error}
            onRetry={handleRetry}
            onLoadOfflineSample={handleLoadOfflineSample}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Phase 3 & 4: Dual-Pane Synthesis Workspace & Active Recall Study Deck */}
        {result && !isLoading && (
          <section aria-label="Dual-Pane Synthesis Workspace" className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <DualPaneWorkspace
              sourceText={text}
              result={result}
              onNewArticle={() => setResult(null)}
              onTraceSource={(card) => setSelectedCardForTrace(card)}
              documentTitle={(() => {
                if (selectedSampleId) {
                  const sample = CURATED_SAMPLES.find((s) => s.id === selectedSampleId);
                  if (sample && text.trim() === sample.content.trim()) {
                    return sample.title;
                  }
                }
                const trimmed = text.trim();
                if (!trimmed) return 'Source Document';
                const firstLine = trimmed.split('\n')[0].replace(/^[#\s*_-]+/, '').trim();
                if (firstLine && firstLine.length <= 100) {
                  return firstLine;
                }
                return 'Custom Document';
              })()}
            />
          </section>
        )}

      </main>

      {/* Provenance Trace Modal */}
      <ProvenanceModal
        card={selectedCardForTrace}
        onClose={() => setSelectedCardForTrace(null)}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SmartBrief &copy; 2026 &bull; Semantic Knowledge Extraction & Provenance Engine</span>
          <span>Docker Orchestrated &bull; Next.js 14 &bull; FastAPI</span>
        </div>
      </footer>
    </div>
  );
}
