import React, { useState, useRef, useId } from 'react';
import { Send, FileText, Sparkles, AlertTriangle, AlertCircle, Trash2, CheckCircle2, Clock, Cpu, X } from 'lucide-react';
import { CURATED_SAMPLES, CuratedSample } from '@/lib/sampleData';

export interface IngestionHubProps {
  text: string;
  setText: (text: string) => void;
  onSubmit: (text: string) => Promise<void>;
  isLoading: boolean;
  selectedSampleId?: string | null;
  onSelectSampleId?: (sampleId: string) => void;
}

export default function IngestionHub({
  text,
  setText,
  onSubmit,
  isLoading,
  selectedSampleId,
  onSelectSampleId,
}: IngestionHubProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeDomain, setActiveDomain] = useState<string>(selectedSampleId || 'neuro-symbolic-ai');
  const lastSubmitTimeRef = useRef<number>(0);
  const textareaId = useId();

  // Word count & character count
  const trimmed = text.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const charCount = text.length;

  // Token and latency estimation
  const estTokens = Math.round(wordCount * 1.33);
  const estSeconds = wordCount === 0 ? 0 : Math.max(2, Math.min(15, Math.round(wordCount / 120) + 2));

  // Validation states
  const isWhitespaceOnly = trimmed.length === 0;
  const isTooShort = wordCount > 0 && wordCount < 50;
  const isMassive = wordCount > 50000;
  const isOptimal = wordCount >= 50 && wordCount <= 50000;

  const handleSelectSample = (sample: CuratedSample) => {
    setActiveDomain(sample.id);
    onSelectSampleId?.(sample.id);
    setText(sample.content);
  };

  const handleLoadSampleButton = () => {
    const sample = CURATED_SAMPLES.find(s => s.id === activeDomain) || CURATED_SAMPLES[0];
    handleSelectSample(sample);
  };

  const handleClearClick = () => {
    if (!text.trim()) {
      setText('');
      return;
    }
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    setText('');
    setShowClearConfirm(false);
  };

  const cancelClear = () => {
    setShowClearConfirm(false);
  };

  const handleSubmitInternal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 600) {
      // Debounce duplicate clicks
      return;
    }
    lastSubmitTimeRef.current = now;

    if (isWhitespaceOnly || isLoading) return;
    await onSubmit(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+Enter or Ctrl+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isWhitespaceOnly && !isLoading) {
        handleSubmitInternal();
      }
    }
  };

  return (
    <section
      aria-labelledby="ingestion-hub-heading"
      className="bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-slate-200 transition-all"
    >
      {/* Header & Sample Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
        <div>
          <h2 id="ingestion-hub-heading" className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Multi-Modal Ingestion Hub
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Paste research articles or select a curated knowledge domain for deterministic Oxigraph verification.
          </p>
        </div>

        {/* Curated Sample Library Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:inline">
            Curated Samples:
          </span>
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
            {CURATED_SAMPLES.map((sample) => {
              const isCurrent = activeDomain === sample.id && text === sample.content;
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  disabled={isLoading}
                  title={`Load ${sample.title}`}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    isCurrent
                      ? 'bg-white text-blue-700 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  } disabled:opacity-50`}
                >
                  {sample.domain}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleLoadSampleButton}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/90 rounded-xl transition-all shadow-xs disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Load Sample Article
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmitInternal} className="space-y-4">
        {/* Main Textarea */}
        <div className="relative">
          <label htmlFor={textareaId} className="sr-only">
            Article or research text
          </label>
          <textarea
            id={textareaId}
            rows={9}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (selectedSampleId) {
                onSelectSampleId?.(null as any);
              }
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Paste your article or long-form research text here (or select a curated domain above)..."
            className="w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 transition-all font-sans leading-relaxed resize-y"
          />
        </div>

        {/* Input Boundaries & Non-Blocking Validation Alerts */}
        {isTooShort && (
          <div
            role="status"
            className="rounded-xl bg-amber-50 border border-amber-200/80 p-3 flex items-start gap-2.5 text-xs text-amber-800 animate-in fade-in duration-200"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Short input notice:</span>{' '}
              Text is too short for meaningful semantic knowledge extraction (minimum 50 words recommended).
              You can still submit, but generated concepts may be limited.
            </div>
          </div>
        )}

        {isMassive && (
          <div
            role="status"
            className="rounded-xl bg-sky-50 border border-sky-200/80 p-3 flex items-start gap-2.5 text-xs text-sky-800 animate-in fade-in duration-200"
          >
            <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Massive document notice:</span>{' '}
              Massive document (&gt;50,000 words): processing time may be significantly extended.
            </div>
          </div>
        )}

        {/* Real-time Metadata Counters & Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          {/* Live Metrics: Word count, Char count, Tokens, Latency */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              Words: <strong className="text-slate-800 font-semibold">{wordCount}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1">
              Characters: <strong className="text-slate-800 font-semibold">{charCount}</strong>
            </span>
            {wordCount > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-slate-600" title="Estimated model tokens">
                  <Cpu className="w-3 h-3 text-slate-400" />
                  Est. Tokens: <strong className="text-slate-700 font-medium">~{estTokens}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-slate-600" title="Estimated pipeline latency">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Est. Latency: <strong className="text-slate-700 font-medium">~{estSeconds}s</strong>
                </span>
              </>
            )}
            {isOptimal && (
              <>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Optimal Length
                </span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {text && !isLoading && (
              <button
                type="button"
                onClick={handleClearClick}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}

            <button
              type="submit"
              disabled={isWhitespaceOnly || isLoading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Analyze & Generate Flashcards</span>
              <span className="hidden md:inline-block text-[10px] font-normal text-blue-200 bg-blue-700/40 px-1.5 py-0.5 rounded ml-1 border border-blue-400/20">
                ⌘↵
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Clear Confirmation Modal / Prompt Dialog */}
      {showClearConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <AlertCircle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={cancelClear}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 id="clear-dialog-title" className="text-base font-bold text-slate-900">
                Clear Article Content?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to wipe your entered article ({wordCount} words)? Any unanalyzed draft text will be lost.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={cancelClear}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Keep Writing
              </button>
              <button
                type="button"
                onClick={confirmClear}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs"
              >
                Yes, Clear Text
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
