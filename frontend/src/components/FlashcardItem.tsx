import React, { useState } from 'react';
import { HelpCircle, Eye, EyeOff, Search, Compass, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Flashcard } from '@/types';

interface FlashcardItemProps {
  card: Flashcard;
  index: number;
  onTraceSource: (card: Flashcard) => void;
}

export default function FlashcardItem({ card, index, onTraceSource }: FlashcardItemProps) {
  const [showAnswer, setShowAnswer] = useState(false);

  // Extract provenance node id for quick preview
  const provObj = typeof card.provenance === 'object' && card.provenance !== null ? card.provenance : {};
  const linkedNode = provObj.graph_node || provObj.node_id || provObj.concept;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/90 hover:border-blue-400 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Card Top Meta */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            <HelpCircle className="w-3.5 h-3.5" />
            Card {index + 1}
          </span>

          {card.category && (
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
              {card.category}
            </span>
          )}
        </div>

        {/* Question */}
        <div className="mb-4">
          <h4 className="text-base font-semibold text-slate-900 leading-snug group-hover:text-blue-900 transition-colors">
            {card.question}
          </h4>
        </div>

        {/* Answer section */}
        <div className="space-y-3 mb-5">
          <button
            type="button"
            onClick={() => setShowAnswer(!showAnswer)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors focus:outline-none"
          >
            {showAnswer ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Hide Answer
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Show Answer
              </>
            )}
          </button>

          {showAnswer ? (
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-sm text-emerald-950 leading-relaxed animate-in fade-in duration-200">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-xs uppercase tracking-wider text-emerald-700 block mb-1">Answer</span>
                  {card.answer}
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setShowAnswer(true)}
              className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 text-center cursor-pointer hover:bg-slate-100/80 transition-colors"
            >
              Click to reveal answer
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: Provenance Info & Trace Source Button */}
      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {linkedNode ? (
          <div className="text-[11px] text-slate-500 truncate max-w-[170px]" title={String(linkedNode)}>
            <span className="font-medium text-slate-600">Node:</span> <span className="font-mono text-indigo-600">{String(linkedNode)}</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Provenance attached</span>
        )}

        <button
          type="button"
          onClick={() => onTraceSource(card)}
          data-testid={`trace-source-btn-${index}`}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/90 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <Compass className="w-3.5 h-3.5 text-indigo-600" />
          <span>Trace Source</span>
        </button>
      </div>
    </div>
  );
}
