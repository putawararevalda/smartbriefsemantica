import React, { useState } from 'react';
import { Send, FileText, Sparkles, RefreshCw } from 'lucide-react';

interface InputFormProps {
  onSubmit: (text: string) => Promise<void>;
  isLoading: boolean;
}

const SAMPLE_ARTICLE = `The evolution of artificial intelligence is entering a new paradigm powered by semantic knowledge graphs and neuro-symbolic reasoning. While large language models excel at natural language understanding and text generation, they often suffer from hallucinations and lack transparent decision lineages. 

To bridge this critical gap, hybrid architectures combine deep learning representations with deterministic triplestores such as Oxigraph. By extracting entities and semantic relationships into an RDF knowledge graph, intelligent agents can verify facts, trace claims back to primary sources, and generate explainable Q&A flashcards. 

Crucially, modern AI governance requires complete provenance tracking. Through dedicated provenance managers like Semantica, every inference step, concept extraction, and synthesized insight is permanently anchored with an audit trail linking directly to specific knowledge graph nodes and original text excerpts.`;

export default function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [text, setText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    await onSubmit(text);
  };

  const handleLoadSample = () => {
    setText(SAMPLE_ARTICLE);
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Article Input
          </h2>
          <p className="text-sm text-slate-500">
            Paste any article or document text to extract knowledge graph concepts and flashcards with provenance.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadSample}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Load Sample Article
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            id="article-text"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isLoading}
            placeholder="Paste your article or long-form text here..."
            className="w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all font-sans leading-relaxed resize-y"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span>Words: <strong className="text-slate-700">{wordCount}</strong></span>
            <span>•</span>
            <span>Characters: <strong className="text-slate-700">{charCount}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            {text && !isLoading && (
              <button
                type="button"
                onClick={() => setText('')}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Clear
              </button>
            )}

            <button
              type="submit"
              disabled={!text.trim() || isLoading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/25 transition-all"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing Semantics...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Analyze & Generate Flashcards
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
