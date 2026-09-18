'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import InputForm from '@/components/InputForm';
import SummaryCard from '@/components/SummaryCard';
import KnowledgeGraphCard from '@/components/KnowledgeGraphCard';
import FlashcardsGrid from '@/components/FlashcardsGrid';
import ProvenanceModal from '@/components/ProvenanceModal';
import { ProcessResponse, Flashcard } from '@/types';
import { AlertCircle, ArrowDown, Sparkles } from 'lucide-react';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [selectedCardForTrace, setSelectedCardForTrace] = useState<Flashcard | null>(null);

  const handleSubmit = async (text: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned error status ${res.status}`);
      }

      const data: ProcessResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'An unexpected error occurred while processing the text.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome / Hero Banner */}
        <section className="text-center max-w-3xl mx-auto pt-2 pb-4 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100/80 text-blue-800 border border-blue-200 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Next.js + FastAPI + Semantica Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Synthesize Knowledge with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Verifiable Provenance</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Extract articles into structured RDF knowledge graphs and interactive Q&A flashcards. Every generated answer is anchored to an immutable Oxigraph node and verifiable audit trail.
          </p>
        </section>

        {/* Input Form */}
        <InputForm onSubmit={handleSubmit} isLoading={isLoading} />

        {/* Error Alert */}
        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3 text-sm text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Processing Failed</p>
              <p className="text-rose-700 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results Area */}
        {result && (
          <div className="space-y-8 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Executive Summary */}
            {result.summary && <SummaryCard summary={result.summary} />}

            {/* Knowledge Graph Concepts */}
            {(result.graph_nodes || result.concepts) && (
              <KnowledgeGraphCard concepts={result.graph_nodes || result.concepts} />
            )}

            {/* Flashcards Grid */}
            {result.flashcards && result.flashcards.length > 0 && (
              <FlashcardsGrid
                flashcards={result.flashcards}
                onTraceSource={(card) => setSelectedCardForTrace(card)}
              />
            )}
          </div>
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
